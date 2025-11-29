/**
 * app.js
 * Lógica de busca com Correção de Geolocalização (BrasilAPI + Nominatim)
 */

let map = null;
let markers = [];
let userMarker = null;

function initMap() {
    // Centraliza inicialmente em SBC
    map = L.map('map').setView([-23.6914, -46.5646], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

async function handleSearch(e) {
    e.preventDefault();
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    const number = document.getElementById('number').value;
    const dob = document.getElementById('dob').value;
    const btn = document.getElementById('btnSearch');
    const loading = document.getElementById('loading');
    
    // Checkboxes
    const integralChecked = document.getElementById('periodIntegral').checked;
    const parcialChecked = document.getElementById('periodParcial').checked;

    if (cep.length !== 8) return alert('CEP inválido. Digite 8 números.');
    if (!integralChecked && !parcialChecked) return alert('Selecione ao menos um período (Integral ou Parcial).');

    // 1. Determina Classificação
    const classification = determineClassification(dob);
    const classResultDiv = document.getElementById('classificationResult');
    const classNameSpan = document.getElementById('className');
    
    if (!classification) {
        classResultDiv.classList.remove('hidden');
        classResultDiv.style.background = '#fef2f2';
        classResultDiv.style.borderColor = '#fecaca';
        classNameSpan.innerText = 'Nenhuma classificação para esta data.';
        classNameSpan.style.color = '#ef4444';
        return;
    }

    classResultDiv.classList.remove('hidden');
    classResultDiv.style.background = '#f0f9ff';
    classResultDiv.style.borderColor = '#bae6fd';
    classNameSpan.innerText = classification.name;
    classNameSpan.style.color = '#0284c7';

    // 2. Geolocalização (FIXED)
    btn.disabled = true;
    loading.classList.remove('hidden');
    loading.innerHTML = '<small>Identificando endereço...</small>';

    try {
        // Nova função de geocodificação mais robusta
        const userLocation = await smartGeocode(cep, number);
        
        if (!userLocation) {
            throw new Error('Digite novamente o CEP. Não foi possível localizar este endereço no mapa.');
        }

        loading.innerHTML = '<small>Buscando escolas próximas...</small>';

        // 3. Buscar Escolas (Top 5 Integral, Top 5 Parcial)
        const results = {};
        
        if (integralChecked) {
            results.integral = findSchoolsByPeriod(userLocation, classification.id, 'integral');
        }
        if (parcialChecked) {
            results.parcial = findSchoolsByPeriod(userLocation, classification.id, 'parcial');
        }
        
        // 4. Renderizar
        renderResults(results, userLocation);

    } catch (err) {
        alert(err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        loading.classList.add('hidden');
    }
}

function determineClassification(dobStr) {
    const dob = new Date(dobStr);
    const classifications = Storage.getClassifications();
    return classifications.find(c => {
        const start = new Date(c.start);
        const end = new Date(c.end);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        dob.setHours(0,0,0,0);
        return dob >= start && dob <= end;
    });
}

/**
 * smartGeocode
 * 1. Busca o nome da rua via BrasilAPI (muito mais preciso que o OSM para CEPs).
 * 2. Envia "Rua + Número" para o Nominatim para pegar a lat/lon exata.
 */
async function smartGeocode(cep, number) {
    let streetName = '';
    let neighborhood = '';

    // Passo 1: Converter CEP em Rua (BrasilAPI)
    try {
        const cepRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        if (cepRes.ok) {
            const cepData = await cepRes.json();
            streetName = cepData.street; // Ex: Rua MMDC
            neighborhood = cepData.neighborhood;
        }
    } catch (e) {
        console.warn('BrasilAPI falhou ou offline, tentando fallback direto...');
    }

    // Passo 2: Construir a query para o Nominatim
    // Se achou o nome da rua, busca por: "Rua X, 123, São Bernardo do Campo"
    // Se não achou, tenta pelo CEP mesmo (fallback menos preciso)
    let query = '';
    if (streetName) {
        query = `${streetName}, ${number}, São Bernardo do Campo, Brazil`;
    } else {
        query = `${number}, ${cep}, São Bernardo do Campo, Brazil`;
    }

    // Passo 3: Buscar Lat/Lon no OpenStreetMap (Nominatim)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                display_name: streetName ? `${streetName}, ${number}` : data[0].display_name
            };
        }
        
        // Tentativa desesperada: Se falhar com número, tenta buscar só a rua (centro da rua)
        if (streetName) {
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${streetName}, São Bernardo do Campo`)}&limit=1`;
            const res2 = await fetch(fallbackUrl);
            const data2 = await res2.json();
            if (data2 && data2.length > 0) {
                return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon), display_name: streetName };
            }
        }

        return null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

function findSchoolsByPeriod(userCoords, classId, type) {
    const allSchools = Storage.getSchools();
    
    // Filtro: Escola deve ter a classificação E o tipo (integral/parcial)
    const eligible = allSchools.filter(s => {
        if (!s.offerings) return false;
        return s.offerings.some(o => o.id === classId && o.type === type);
    });

    // Calcular Distância
    const withDist = eligible.map(s => {
        return { 
            ...s, 
            distance: getDistanceFromLatLonInKm(userCoords.lat, userCoords.lon, s.lat, s.lon) 
        };
    });

    // Ordenar (Menor distância primeiro)
    withDist.sort((a, b) => a.distance - b.distance);

    // Retornar Top 5
    return withDist.slice(0, 5);
}

function renderResults(results, userCoords) {
    const list = document.getElementById('resultsList');
    list.innerHTML = '';

    // Limpar marcadores antigos
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (userMarker) map.removeLayer(userMarker);

    // Adicionar marcador do Usuário
    userMarker = L.marker([userCoords.lat, userCoords.lon])
        .addTo(map)
        .bindPopup(`<b>Sua Localização</b><br>${userCoords.display_name}`)
        .openPopup();

    let hasResults = false;
    const addedToMapIds = new Set(); 

    // Helper de renderização
    const renderSection = (title, schools, badgeClass) => {
        if (!schools || schools.length === 0) return '';
        hasResults = true;
        
        const htmlItems = schools.map((s, idx) => {
            if (!addedToMapIds.has(s.id)) {
                const marker = L.marker([s.lat, s.lon]).addTo(map)
                    .bindPopup(`<b>${s.name}</b><br>${s.address}`);
                markers.push(marker);
                addedToMapIds.add(s.id);
            }

            return `
                <div class="school-item" onclick="focusOnSchool(${s.lat}, ${s.lon})">
                    <div class="flex" style="justify-content: space-between;">
                        <h3>${idx + 1}. ${s.name}</h3>
                        <span class="badge ${badgeClass}">${title}</span>
                    </div>
                    <p class="text-sm" style="color: var(--text-light);">${s.address}</p>
                </div>
            `;
        }).join('');

        return `
            <div class="result-section">
                <h3 class="section-title">${title} (${schools.length})</h3>
                ${htmlItems}
            </div>
        `;
    };

    if (results.integral) {
        list.innerHTML += renderSection('Período Integral', results.integral, 'badge-integral');
    }
    
    if (results.integral && results.integral.length > 0 && results.parcial && results.parcial.length > 0) {
        list.innerHTML += '<hr style="margin: 1.5rem 0; border: 0; border-top: 1px solid #e2e8f0;">';
    }

    if (results.parcial) {
        list.innerHTML += renderSection('Período Parcial', results.parcial, 'badge-parcial');
    }

    if (!hasResults) {
        list.innerHTML = '<p class="text-center">Nenhuma escola encontrada para os critérios selecionados.</p>';
    }

    // Ajustar zoom para mostrar tudo
    const group = new L.featureGroup([userMarker, ...markers]);
    map.fitBounds(group.getBounds().pad(0.1));
}

function focusOnSchool(lat, lon) {
    map.setView([lat, lon], 16);
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

function deg2rad(deg) { return deg * (Math.PI/180); }

initMap();

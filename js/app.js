/**
 * app.js
 * - Pino Verde Arrastável
 * - Seleção Exclusiva (Integral OU Parcial)
 * - Otimização de Rota (OSRM) para evitar queda
 */

let map = null;
let schoolMarkers = []; 
let userMarker = null;  
let currentClassId = null; 

// Configuração do Ícone Verde
const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function initMap() {
    map = L.map('map').setView([-23.6914, -46.5646], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

async function handleSearch(e) {
    if (e) e.preventDefault();
    
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    const number = document.getElementById('number').value;
    const dob = document.getElementById('dob').value;
    const btn = document.getElementById('btnSearch');
    const loading = document.getElementById('loading');
    
    // Verificação dos Radios
    const integralChecked = document.getElementById('periodIntegral').checked;
    const parcialChecked = document.getElementById('periodParcial').checked;

    if (cep.length !== 8) return alert('CEP inválido. Digite 8 números.');
    // Garantia extra, embora o HTML já force um checked
    if (!integralChecked && !parcialChecked) return alert('Selecione um período.');

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

    currentClassId = classification.id;
    classResultDiv.classList.remove('hidden');
    classResultDiv.style.background = '#f0f9ff';
    classResultDiv.style.borderColor = '#bae6fd';
    classNameSpan.innerText = classification.name;
    classNameSpan.style.color = '#0284c7';

    btn.disabled = true;
    loading.classList.remove('hidden');
    loading.innerHTML = '<small>Identificando endereço...</small>';

    try {
        const userLocation = await smartGeocode(cep, number);
        
        if (!userLocation) throw new Error('Endereço não encontrado.');

        await updateMapAndResults(userLocation);

    } catch (err) {
        alert(err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        loading.classList.add('hidden');
    }
}

async function updateMapAndResults(coords) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('hidden');
        loading.innerHTML = '<small>Calculando rotas...</small>';
    }

    // 1. Gerencia o Marcador do Usuário (Verde)
    if (!userMarker) {
        userMarker = L.marker([coords.lat, coords.lon], {
            icon: greenIcon,
            draggable: true,
            title: "Arraste para corrigir"
        }).addTo(map);

        // Ao arrastar, recalcula
        userMarker.on('dragend', async function(event) {
            const position = event.target.getLatLng();
            await updateMapAndResults({ lat: position.lat, lon: position.lng });
        });
        
        userMarker.bindPopup("<b>Você está aqui</b><br>Arraste o pino verde se necessário.").openPopup();
    } else {
        userMarker.setLatLng([coords.lat, coords.lon]);
        if (!userMarker.isPopupOpen()) {
            userMarker.setPopupContent("<b>Localização Atualizada</b>").openPopup();
        }
    }

    // 2. Limpa mapa anterior
    schoolMarkers.forEach(m => map.removeLayer(m));
    schoolMarkers = [];

    // 3. Define qual busca fazer (Integral OU Parcial)
    const isIntegral = document.getElementById('periodIntegral').checked;
    
    const results = {};
    
    // Busca OSRM apenas para o tipo selecionado
    if (isIntegral) {
        results.integral = await findSchoolsWithOsrm(coords, currentClassId, 'integral');
    } else {
        results.parcial = await findSchoolsWithOsrm(coords, currentClassId, 'parcial');
    }

    renderListAndSchoolMarkers(results);

    const group = new L.featureGroup([userMarker, ...schoolMarkers]);
    map.fitBounds(group.getBounds().pad(0.1));

    if (loading) loading.classList.add('hidden');
}

function renderListAndSchoolMarkers(results) {
    const list = document.getElementById('resultsList');
    list.innerHTML = '';
    
    const addedToMapIds = new Set();

    const renderSection = (title, schools, badgeClass) => {
        if (!schools || schools.length === 0) return '';
        
        const htmlItems = schools.map((s, idx) => {
            if (!addedToMapIds.has(s.id)) {
                // Mapa: Mostra nome e endereço no Popup (sem a quilometragem)
                const marker = L.marker([s.lat, s.lon])
                    .addTo(map)
                    .bindPopup(`<b>${s.name}</b><br>${s.address}`);
                schoolMarkers.push(marker);
                addedToMapIds.add(s.id);
            }

            // Lista: Mostra apenas nome e endereço
            return `<div class="school-item" onclick="focusOnSchool(${s.lat}, ${s.lon})">
                    <div class="flex" style="justify-content: space-between;">
                        <h3>${idx + 1}. ${s.name}</h3>
                        <span class="badge ${badgeClass}">${title}</span>
                    </div>
                    <p class="text-sm" style="color: var(--text-light);">${s.address}</p>
                </div>`;
        }).join('');

        return `<div class="result-section"><h3 class="section-title">${title} (${schools.length})</h3>${htmlItems}</div>`;
    };

    let hasRes = false;
    
    // Renderiza apenas o bloco correspondente
    if (results.integral) { 
        list.innerHTML += renderSection('Período Integral', results.integral, 'badge-integral'); 
        hasRes = true; 
    }
    
    if (results.parcial) { 
        list.innerHTML += renderSection('Período Parcial', results.parcial, 'badge-parcial'); 
        hasRes = true; 
    }

    if (!hasRes) list.innerHTML = '<p class="text-center">Nenhuma escola encontrada para este período.</p>';
}

// --- LÓGICA OSRM SEGURA ---

async function findSchoolsWithOsrm(userCoords, classId, type) {
    const allSchools = Storage.getSchools();
    const eligible = allSchools.filter(s => s.offerings && s.offerings.some(o => o.id === classId && o.type === type));

    // 1. Filtro rápido por Linha Reta
    const tempWithDist = eligible.map(s => ({ 
        ...s, 
        tempDist: getDistanceFromLatLonInKm(userCoords.lat, userCoords.lon, s.lat, s.lon) 
    }));

    // 2. Pega apenas as 3 mais próximas para consultar a rota
    tempWithDist.sort((a, b) => a.tempDist - b.tempDist);
    const topCandidates = tempWithDist.slice(0, 3); 

    // 3. Consulta API OSRM
    const finalSchools = await Promise.all(topCandidates.map(async (s) => {
        const realDist = await getOsrmRouteDistance(userCoords, { lat: s.lat, lon: s.lon });
        
        // Se API funcionar, usa rota. Se falhar, usa linha reta.
        if (realDist !== null) {
            return { ...s, distance: realDist, isRoute: true };
        } else {
            return { ...s, distance: s.tempDist, isRoute: false };
        }
    }));

    // Reordena final
    finalSchools.sort((a, b) => a.distance - b.distance);
    return finalSchools;
}

// Timeout de 10 segundos para espera
async function getOsrmRouteDistance(start, end) {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) return null;
        
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return data.routes[0].distance / 1000;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- Helpers ---

function determineClassification(dobStr) {
    const dob = new Date(dobStr);
    const classifications = Storage.getClassifications();
    return classifications.find(c => {
        const start = new Date(c.start);
        const end = new Date(c.end);
        start.setHours(0,0,0,0); end.setHours(0,0,0,0); dob.setHours(0,0,0,0);
        return dob >= start && dob <= end;
    });
}

async function smartGeocode(cep, number) {
    let streetName = '';
    try {
        const cepRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        if (cepRes.ok) {
            const cepData = await cepRes.json();
            streetName = cepData.street;
        }
    } catch (e) {}

    let query = streetName ? `${streetName}, ${number}, São Bernardo do Campo, Brazil` : `${number}, ${cep}, São Bernardo do Campo, Brazil`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display_name: streetName || data[0].display_name };
        
        if (streetName) {
            const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(streetName + ", São Bernardo do Campo")}&limit=1`);
            const fallbackData = await fallbackRes.json();
            if (fallbackData && fallbackData.length > 0) return { lat: parseFloat(fallbackData[0].lat), lon: parseFloat(fallbackData[0].lon), display_name: streetName };
        }
        return null;
    } catch (e) { return null; }
}

function focusOnSchool(lat, lon) { map.setView([lat, lon], 16); }
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }

initMap();

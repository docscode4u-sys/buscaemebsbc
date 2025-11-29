/**
 * storage.js
 * Handles data persistence using localStorage (Read-Only version).
 */

const STORAGE_KEYS = {
    SCHOOLS: 'sbc_schools_v2', // Changed version key to force refresh
    CLASSIFICATIONS: 'sbc_classifications_v1'
};

// Initial Seed Data
const SEED_DATA = {
    CLASSIFICATIONS: [
        { id: 'c1', name: 'Berçário I', start: '2024-04-01', end: '2025-03-31' },
        { id: 'c2', name: 'Berçário II', start: '2023-04-01', end: '2024-03-31' },
        { id: 'c3', name: 'Infantil I', start: '2022-04-01', end: '2023-03-31' },
        { id: 'c4', name: 'Infantil II', start: '2021-04-01', end: '2022-03-31' },
        { id: 'c5', name: 'Infantil III', start: '2020-04-01', end: '2021-03-31' }
    ],
    SCHOOLS: [
        {
            id: 's1',
            name: 'EMEB Arlindo Miguel Teixeira',
            address: 'Estrada dos Alvarengas, 7500 - Assunção',
            lat: -23.7450096,
            lon: -46.6150168,
            // Cada objeto define: Classificação atendida + Tipo (Integral/Parcial)
            offerings: [
                { id: 'c1', type: 'integral' }, { id: 'c1', type: 'parcial' },
                { id: 'c2', type: 'integral' },
                { id: 'c3', type: 'integral' }, { id: 'c3', type: 'parcial' },
                { id: 'c4', type: 'parcial' },
                { id: 'c5', type: 'parcial' }
            ]
        },
        {
            id: 's2',
            name: 'EMEB Salvador Gordilho',
            address: 'Rua dos Vianas, 2500 - Baeta Neves',
            lat: -23.6950,
            lon: -46.5400,
            offerings: [
                { id: 'c3', type: 'parcial' },
                { id: 'c4', type: 'integral' }, { id: 'c4', type: 'parcial' },
                { id: 'c5', type: 'integral' }
            ]
        },
        {
            id: 's3',
            name: 'EMEB Prof. Ramiro Gonçaves',
            address: 'Rua Continental, 600 - Jardim do Mar',
            lat: -23.6850,
            lon: -46.5600,
            offerings: [
                { id: 'c1', type: 'integral' },
                { id: 'c2', type: 'integral' }
            ]
        },
        {
            id: 's4',
            name: 'EMEB Exemplo Centro',
            address: 'Rua Jurubatuba, 100 - Centro',
            lat: -23.7100,
            lon: -46.5500,
            offerings: [
                { id: 'c1', type: 'parcial' },
                { id: 'c2', type: 'parcial' },
                { id: 'c3', type: 'parcial' },
                { id: 'c4', type: 'parcial' },
                { id: 'c5', type: 'parcial' }
            ]
        },
        {
            id: 's5',
            name: 'EMEB Rudge Ramos',
            address: 'Av. Caminho do Mar, 2000',
            lat: -23.6600,
            lon: -46.5700,
            offerings: [
                { id: 'c3', type: 'integral' }, { id: 'c3', type: 'parcial' },
                { id: 'c4', type: 'integral' },
                { id: 'c5', type: 'integral' }
            ]
        },
         {
            id: 's6',
            name: 'EMEB Taboão',
            address: 'Rua Suíça, 500',
            lat: -23.6700,
            lon: -46.5900,
            offerings: [
                { id: 'c3', type: 'integral' },
                { id: 'c4', type: 'integral' }
            ]
        }
    ]
};

const Storage = {
    init() {
        // Se mudar a chave de versão, limpa o antigo para atualizar os dados novos
        if (!localStorage.getItem(STORAGE_KEYS.SCHOOLS)) {
            localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(SEED_DATA.SCHOOLS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.CLASSIFICATIONS)) {
            localStorage.setItem(STORAGE_KEYS.CLASSIFICATIONS, JSON.stringify(SEED_DATA.CLASSIFICATIONS));
        }
    },

    getSchools() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHOOLS) || '[]');
    },

    getClassifications() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSIFICATIONS) || '[]');
    }
};

Storage.init();
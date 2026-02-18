// cache_manager.js - SISTEMA DE CACHE AVANÇADO COM INDEXEDDB
// Suporta 50MB+ de dados (vs 5-10MB do localStorage)
// Inclui compressão automática de fotos

class CacheManager {
    constructor(dbName = 'ChecklistCache', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    // ============================================
    // INICIALIZAÇÃO DO INDEXEDDB
    // ============================================
    
    async init() {
        if (this.db) return this.db;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('❌ Erro ao abrir IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB inicializado com sucesso!');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store para checklists
                if (!db.objectStoreNames.contains('checklists')) {
                    const checklistStore = db.createObjectStore('checklists', { keyPath: 'id' });
                    checklistStore.createIndex('data_criacao', 'data_criacao', { unique: false });
                    checklistStore.createIndex('placa', 'placa', { unique: false });
                    checklistStore.createIndex('atualizado_em', 'atualizado_em', { unique: false });
                }
                
                // Store para fotos (separado para otimização)
                if (!db.objectStoreNames.contains('fotos')) {
                    const fotoStore = db.createObjectStore('fotos', { keyPath: 'id' });
                    fotoStore.createIndex('checklist_id', 'checklist_id', { unique: false });
                }
                
                // Store para metadados
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
                
                console.log('📊 IndexedDB estrutura criada!');
            };
        });
    }

    // ============================================
    // COMPRESSÃO DE FOTOS
    // ============================================
    
    async comprimirFoto(base64, qualidade = 0.7, maxWidth = 1200) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Redimensionar se necessário
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Comprimir
                    const comprimida = canvas.toDataURL('image/jpeg', qualidade);
                    
                    const tamanhoOriginal = base64.length;
                    const tamanhoComprimido = comprimida.length;
                    const reducao = ((1 - tamanhoComprimido / tamanhoOriginal) * 100).toFixed(1);
                    
                    console.log(`🗜️ Foto comprimida: ${reducao}% menor (${(tamanhoOriginal/1024).toFixed(0)}KB → ${(tamanhoComprimido/1024).toFixed(0)}KB)`);
                    
                    resolve(comprimida);
                };
                
                img.onerror = reject;
                img.src = base64;
                
            } catch (error) {
                console.error('❌ Erro ao comprimir foto:', error);
                resolve(base64); // Retorna original em caso de erro
            }
        });
    }
    
    async comprimirFotos(fotos, qualidade = 0.7) {
        if (!fotos || fotos.length === 0) return [];
        
        console.log(`⏳ Comprimindo ${fotos.length} foto(s)...`);
        
        const comprimidas = await Promise.all(
            fotos.map(foto => this.comprimirFoto(foto, qualidade))
        );
        
        return comprimidas;
    }

    // ... (resto do código continua igual)
}

const cacheManager = new CacheManager();
if (typeof window !== 'undefined') window.cacheManager = cacheManager;
console.log('✅ Cache Manager carregado [Volpini]!');

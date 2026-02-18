// sync_manager.js - SINCRONIZAÇÃO INTELIGENTE [VOLPINI]
// Versão standalone (sem ES6 modules)

(function() {
    'use strict';
    
    class SyncManager {
        constructor() {
            this.syncEmAndamento = false;
            this.ultimaSync = null;
        }

        async sincronizarInteligente(forcarCompleto = false) {
            if (this.syncEmAndamento) {
                console.warn('⚠️ Sincronização já em andamento...');
                return { sucesso: false, mensagem: 'Sync em andamento' };
            }
            
            try {
                this.syncEmAndamento = true;
                console.log('🔄 Iniciando sincronização inteligente [Volpini]...');
                
                const cache = window.cacheManager;
                if (!cache) {
                    throw new Error('CacheManager não inicializado. Carregue cache_manager.js primeiro!');
                }
                
                if (typeof buscarChecklistsMesAtual !== 'function') {
                    throw new Error('firebase_app.js não carregado. Verifique se está incluído no HTML.');
                }
                
                const ultimaSync = await cache.getUltimaSincronizacao();
                
                let checklistsNuvem = [];
                let estrategia = '';
                
                if (!ultimaSync || forcarCompleto) {
                    estrategia = 'completa';
                    console.log('🆕 Primeira sincronização ou forçada - buscando mês completo...');
                    checklistsNuvem = await buscarChecklistsMesAtual();
                } else {
                    estrategia = 'incremental';
                    const diffMinutos = Math.floor((Date.now() - new Date(ultimaSync)) / 60000);
                    console.log(`⚡ Sync incremental - última sync há ${diffMinutos} minutos`);
                    
                    if (diffMinutos < 5) {
                        console.log('✅ Dados já estão atualizados (sync recente)');
                        return { sucesso: true, estrategia: 'cache', novos: 0, mensagem: 'Dados já atualizados' };
                    }
                    
                    checklistsNuvem = await this.buscarNovosOuModificados(ultimaSync);
                }
                
                const resultado = await this.sincronizarComCache(checklistsNuvem);
                await cache.setUltimaSincronizacao();
                this.ultimaSync = new Date();
                
                console.log(`✅ Sincronização ${estrategia} concluída!`);
                console.log(`📅 ${resultado.novos} novo(s), ${resultado.atualizados} atualizado(s)`);
                
                return { sucesso: true, estrategia, ...resultado, timestamp: this.ultimaSync.toISOString() };
                
            } catch (error) {
                console.error('❌ Erro na sincronização:', error);
                return { sucesso: false, erro: error.message };
            } finally {
                this.syncEmAndamento = false;
            }
        }
        
        async buscarNovosOuModificados(timestamp) {
            try {
                const checklistsMesAtual = await buscarChecklistsMesAtual();
                const novosOuModificados = checklistsMesAtual.filter(c => 
                    new Date(c.atualizado_em || c.data_criacao) > new Date(timestamp)
                );
                console.log(`🆕 ${novosOuModificados.length} checklist(s) novo(s)/modificado(s)`);
                return novosOuModificados;
            } catch (error) {
                console.error('❌ Erro ao buscar modificados:', error);
                return [];
            }
        }
        
        async sincronizarComCache(checklistsNuvem) {
            const cache = window.cacheManager;
            let novos = 0, atualizados = 0, inalterados = 0;
            
            for (const checklistNuvem of checklistsNuvem) {
                const checklistLocal = await cache.buscarChecklist(checklistNuvem.id);
                
                if (!checklistLocal) {
                    await cache.salvarChecklist(checklistNuvem, true);
                    novos++;
                } else {
                    const dataLocal = checklistLocal.atualizado_em || checklistLocal.data_criacao;
                    const dataNuvem = checklistNuvem.atualizado_em || checklistNuvem.data_criacao;
                    
                    if (new Date(dataNuvem) > new Date(dataLocal)) {
                        await cache.salvarChecklist(checklistNuvem, true);
                        atualizados++;
                    } else {
                        inalterados++;
                    }
                }
            }
            
            return { novos, atualizados, inalterados, total: checklistsNuvem.length };
        }
        
        async exibirEstatisticasSync() {
            const cache = window.cacheManager;
            const ultimaSync = await cache.getUltimaSincronizacao();
            const totalLocal = await cache.contarChecklists();
            
            console.log('📊 === ESTATÍSTICAS SYNC [VOLPINI] ===');
            console.log(`⏰ Última sync: ${ultimaSync ? new Date(ultimaSync).toLocaleString('pt-BR') : 'Nunca'}`);
            console.log(`💾 Total: ${totalLocal} checklist(s)`);
            console.log('========================================');
        }
    }
    
    const syncManager = new SyncManager();
    window.syncManager = syncManager;
    window.syncDebug = {
        sincronizar: (f) => syncManager.sincronizarInteligente(f),
        estatisticas: () => syncManager.exibirEstatisticasSync()
    };
    
    console.log('✅ Sync Manager carregado [Volpini]!');
})();

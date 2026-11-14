import api from '../api';

export const configService = {
    getSmtpConfig: async () => {
        return api.get('/config/smtp');
    },

    saveSmtpConfig: async (configData: any) => {
        return api.post('/config/smtp', configData);
    },

    testSmtpConnection: async (configData: any) => {
        return api.post('/config/smtp/test', configData);
    },

    listXmlFolders: async () => {
        return api.get('/nfce/xml-folders');
    },

    exportXmls: async (data: { folder: string, sendEmail: boolean, emailTo?: string }) => {
        return api.post('/nfce/export-xmls', data);
    },

    getCardapioIpConfig: async () => {
        return api.get('/config/cardapio-ip');
    },

    saveCardapioIpConfig: async (ip: string) => {
        return api.post('/config/cardapio-ip', { ip });
    },

    getTunnelStatus: async () => {
        return api.get('/config/tunnel/status');
    },

    startTunnel: async () => {
        return api.post('/config/tunnel/start');
    },

    stopTunnel: async () => {
        return api.post('/config/tunnel/stop');
    }
};

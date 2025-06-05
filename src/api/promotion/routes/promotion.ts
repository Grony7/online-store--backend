export default {
    routes: [
        {
            method: 'GET',
            path: '/promotions',
            handler: 'promotion.find',
            config: {
                auth: {
                    required: false,
                },
            },
        },
        {
            method: 'GET',
            path: '/promotions/:id',
            handler: 'promotion.findOne',
            config: {
                auth: {
                    required: false,
                },
            },
        },
    ],
}; 
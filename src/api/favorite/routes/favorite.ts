export default {
    routes: [
        {
            method: 'POST',
            path: '/favorites',
            handler: 'favorite.addToFavorites',
            config: {
                auth: { public: false },
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'DELETE',
            path: '/favorites/:productId',
            handler: 'favorite.removeFromFavorites',
            config: {
                auth: { public: false },
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'GET',
            path: '/favorites',
            handler: 'favorite.getUserFavorites',
            config: {
                auth: { public: false },
                policies: [],
                middlewares: [],
            },
        },
    ],
}; 
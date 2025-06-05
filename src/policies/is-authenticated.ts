export default (policyContext, config, { strapi }) => {
    if (policyContext.state.user) {
        // если пользователь аутентифицирован
        return true;
    }

    return false;
}; 
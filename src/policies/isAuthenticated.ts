export default (policyContext, config, { strapi }) => {
  const { state } = policyContext;

  if (!state.user) {
    return false;
  }

  return true;
}; 
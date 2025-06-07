export default (policyContext, config, { strapi }) => {
  const { state, params } = policyContext;

  if (!state.user) {
    return false;
  }

  const currentUser = state.user;
  const { userId } = params;

  // Проверяем, является ли пользователь саппортом
  const isSupport = currentUser.role?.type === 'support' || currentUser.role?.name === 'Support';
  
  // Саппорт может читать все сообщения
  if (isSupport) {
    return true;
  }

  // Обычный пользователь может читать только свои сообщения
  if (currentUser.id.toString() === userId) {
    return true;
  }

  return false;
}; 
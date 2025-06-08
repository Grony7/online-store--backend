# 1) Базовый образ
FROM node:22-alpine

# 2) Рабочая директория
WORKDIR /srv/app

# 3) Копируем package-файлы и ставим зависимости
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# 4) Копируем весь бэкенд-код и собираем Strapi
COPY . .
RUN npm run build

# 5) Открываем порт
EXPOSE 1337

# 6) Запуск
CMD ["npm", "start"]

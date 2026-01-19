# Dzeta Backend Server

Express.js API сервер для Dzeta Client.

## Установка

```bash
npm install
```

## Локальная разработка

```bash
npm run dev
```

Сервер запустится на `http://localhost:5000`

## Production

```bash
npm start
```

## Переменные окружения

Создайте `.env` файл на основе `.env.example`:

```bash
cp .env.example .env
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Вход
- `POST /api/auth/register` - Регистрация

### User
- `GET /api/user/profile` - Получить профиль (требует токен)
- `POST /api/user/change-password` - Изменить пароль

### Products
- `GET /api/products/all` - Получить все продукты

### Promo Codes
- `POST /api/promo/verify` - Проверить промокод
- `GET /api/promo/all` - Получить все промокоды (admin)
- `POST /api/promo/create` - Создать промокод (admin)
- `PUT /api/promo/:id` - Обновить промокод (admin)
- `DELETE /api/promo/:id` - Удалить промокод (admin)

## Развертывание на Railway

1. Создайте аккаунт на [railway.app](https://railway.app)
2. Подключите GitHub репозиторий
3. Установите переменные окружения в Railway
4. Сервер автоматически разместится и будет доступен

## Структура проекта

```
server/
├── index.js           # Основной файл приложения
├── database/
│   └── data.json      # JSON база данных
├── routes/            # API маршруты
├── middleware/        # Express middleware
├── package.json       # Зависимости проекта
└── .env.example       # Пример переменных окружения
```

## Лицензия

ISC

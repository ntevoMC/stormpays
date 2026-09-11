// StromPays users database (static demo)
// Добавляйте пользователей внутрь массива.
// ВАЖНО: это демо-вариант. Пароли видны в исходном коде сайта.

window.STROMPAYS_USERS = [
  {
    id: "admin",
    name: "StromPays Admin",
    email: "admin@strompays.local",
    password: "admin123",
    role: "admin",
    active: true,
    created: "11.09.2026",
    lastLogin: "—",
    balance: 0,
    settings: {
      incomingCurrency: "UAH",
      outgoingCurrency: "UAH",
      commissionIn: 5,
      commissionOut: 2
    }
  }

  {
  "id": "usr_1789108728992",
  "name": "sword",
  "email": "sword@gmail.com",
  "password": "sword",
  "role": "user",
  "active": true,
  "created": "11.09.2026",
  "lastLogin": "—",
  "balance": 20,
  "settings": {
    "incomingCurrency": "UAH",
    "outgoingCurrency": "UAH",
    "commissionIn": 5,
    "commissionOut": 2
  }
}

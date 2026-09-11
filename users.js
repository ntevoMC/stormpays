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

  // Пример пользователя:
  // ,
  // {
  //   id: "usr_001",
  //   name: "Demo User",
  //   email: "user@example.com",
  //   password: "user123",
  //   role: "user",
  //   active: true,
  //   created: "11.09.2026",
  //   lastLogin: "—",
  //   balance: 10,
  //   settings: {
  //     incomingCurrency: "UAH",
  //     outgoingCurrency: "UAH",
  //     commissionIn: 5,
  //     commissionOut: 2
  //   }
  // }
];

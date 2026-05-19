export const regularExps = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, // At least 8 characters, one letter and one number
  username: /^[a-zA-Z0-9_]{3,16}$/, // Alphanumeric and underscores, 3-16 characters
  phone: /^\+?[1-9]\d{1,14}$/, // International phone number format
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
};
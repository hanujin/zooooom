// src/apiClient.js  (rename from index.js for clarity)
import axios from 'axios';
import { API_BASE } from '../config';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // make this match your Login.js
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default apiClient;
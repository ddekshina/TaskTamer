// src/services/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth services
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  getProfile: () => api.get('/auth/me')
};

// Task services
export const tasks = {
  getAll: () => api.get('/tasks'),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (taskData) => api.post('/tasks', taskData),
  update: (id, taskData) => api.patch(`/tasks/${id}`, taskData),
  delete: (id) => api.delete(`/tasks/${id}`)
};

// Routine services
export const routines = {
  getAll: () => api.get('/routines'),
  create: (routineData) => api.post('/routines', routineData),
  update: (id, routineData) => api.patch(`/routines/${id}`, routineData),
  delete: (id) => api.delete(`/routines/${id}`)
};

// Schedule services
export const schedule = {
  get: (startDate, endDate) => 
    api.get(`/schedule?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`),
  recalculate: () => api.post('/schedule/recalculate'),
  completeTimeSlot: (id) => api.patch(`/schedule/${id}/complete`)
};

// Preferences services
export const preferences = {
  get: () => api.get('/preferences'),
  update: (preferencesData) => api.patch('/preferences', preferencesData)
};

export default api;
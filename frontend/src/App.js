// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Context
import { AuthProvider } from './context/AuthContext';

// Layout Components
import Dashboard from './components/layout/Dashboard';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';

// Main View Components
import TaskList from './components/tasks/TaskList';
import TaskDetail from './components/tasks/TaskDetail';
import TaskForm from './components/tasks/TaskForm';
import RoutineList from './components/routines/RoutineList';
import RoutineForm from './components/routines/RoutineForm';
import Schedule from './components/schedule/Schedule';
import Preferences from './components/preferences/Preferences';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" />;
  }
  return children;
};

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      'Arial',
      'sans-serif'
    ].join(','),
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <div className="app">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <div className="app-container">
                    <Navbar />
                    <div className="main-content">
                      <Sidebar />
                      <div className="page-content">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/tasks" element={<TaskList />} />
                          <Route path="/tasks/:id" element={<TaskDetail />} />
                          <Route path="/tasks/new" element={<TaskForm />} />
                          <Route path="/tasks/edit/:id" element={<TaskForm />} />
                          <Route path="/routines" element={<RoutineList />} />
                          <Route path="/routines/new" element={<RoutineForm />} />
                          <Route path="/routines/edit/:id" element={<RoutineForm />} />
                          <Route path="/schedule" element={<Schedule />} />
                          <Route path="/preferences" element={<Preferences />} />
                        </Routes>
                      </div>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
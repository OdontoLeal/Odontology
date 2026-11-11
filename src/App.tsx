// src/App.tsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/routes/AppRouter';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
};

export default App;

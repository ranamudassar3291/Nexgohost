import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ContentProvider } from './ContentContext';
import { CurrencyProvider } from './CurrencyContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ContentProvider>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </ContentProvider>
  </React.StrictMode>
);

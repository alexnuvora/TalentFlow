import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';import {ToastProvider} from './components/Ui';
import {ErrorBoundary} from './components/ErrorBoundary';
import './styles.css';
import './marketing.css';
import './careers.css';
import './customer.css';
import './v9.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><ToastProvider><App/></ToastProvider></ErrorBoundary></React.StrictMode>);

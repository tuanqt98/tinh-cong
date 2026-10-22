import React from 'react'; import ReactDOM from 'react-dom/client'; import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; import { BrowserRouter } from 'react-router-dom'; import { App } from './app.js'; import { AuthProvider } from './auth.js'; import './index.css';
const client=new QueryClient({defaultOptions:{queries:{staleTime:30_000}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>);

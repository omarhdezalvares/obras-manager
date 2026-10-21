import React from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { Avisos, mostrarAviso } from "./components/Aviso";
import "./index.css";

// Toda mutacion exitosa confirma con un aviso; meta.aviso cambia el texto y
// meta.aviso === false lo omite (flujos que ya muestran su confirmacion).
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const aviso = mutation.meta?.aviso;
      if (aviso !== false) mostrarAviso(typeof aviso === "string" ? aviso : "Guardado ✓");
    },
  }),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Avisos />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

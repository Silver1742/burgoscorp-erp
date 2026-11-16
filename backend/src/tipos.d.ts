// Lo que los middlewares agregan a cada pedido (auth → usuario, permisos → permiso, validar → validado).
declare global {
  namespace Express {
    interface Request {
      usuario?: any;
      permiso?: any;
      validado?: any;
    }
  }
}

export {};

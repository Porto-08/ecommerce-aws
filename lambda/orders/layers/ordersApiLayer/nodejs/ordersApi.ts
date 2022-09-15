export enum PaymentType {
  CASH = "CASH",
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
};

export enum ShippingType {
  ECONOMIC = "ECONOMIC",
  URGENT = "URGENT",
};

export enum CarrierType {
  CORREIOS = "CORREIOS",
  FEDEX = "FEDEX",
};

export interface OrderRequest {
  email: string;
  productIds: string[];
  payment: PaymentType;
  shipping: {
    type: ShippingType;
    carrier: CarrierType;
  };
};

export interface OrderProductRespose {
  code: string;
  price: number;
}

export interface OrderResponse {
  email: string;
  id: string;
  createdAt: number;
  billing: {
    payment: PaymentType;
    totalPrice: number;
  };
  shipping: {
    type: ShippingType;
    carrier: CarrierType;
  };
  products: OrderProductRespose[];
};
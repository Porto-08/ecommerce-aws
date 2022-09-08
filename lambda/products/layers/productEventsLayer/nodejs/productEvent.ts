export enum ProductEventType {
  Created = 'PRODUCT_CREATED',
  Updated = 'PRODUCT_UPDATED',
  Deleted = 'PRODUCT_DELETED',
};

export interface ProductEvent {
  requestId: string;
  eventType: ProductEventType;
  productId: string;
  productCode: string;
  productPrice: number;
  email: string;
};
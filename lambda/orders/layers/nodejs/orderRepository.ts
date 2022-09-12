import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { v4 as uuidv4 } from "uuid";


export interface OrderProduct {
  code: string;
  price: number;
}

export interface Order {
  pk: string;
  sk?: string;
  email: string;
  createdAt?: number;
  shipping: {
    type: "URGENT" | "ECONOMIC";
    carrier: "CORREIOS" | "FEDEX";
  },
  billing: {
    payment: "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
    totalPrice: number;
  }
  products: OrderProduct[];
};

export class OrderRepository {
  private ddbClient: DocumentClient;
  private orderDdb: string;

  constructor(ddbClient: DocumentClient, orderDdb: string) {
    this.ddbClient = ddbClient;
    this.orderDdb = orderDdb;
  }

  async createOrder(order: Order): Promise<Order> {
    order.sk = uuidv4();
    order.createdAt = Date.now();

    await this.ddbClient.put({
      TableName: this.orderDdb,
      Item: order,
    }).promise();

    return order;
  };

  async getAllOrders(): Promise<Order[]> {
    const result = await this.ddbClient.scan({
      TableName: this.orderDdb,
    }).promise();

    return result.Items as Order[];
  }
}

import { DocumentClient } from "aws-sdk/clients/dynamodb";

export interface OrderProduct {
  code: string;
  price: number;
}

export interface Order {
  pk: string;
  sk: string;
  createdAt: number;
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
    await this.ddbClient.put({
      TableName: this.orderDdb,
      Item: order,
    }).promise();

    return order;
  };

  async getAllOrders(): Promise<Order[]> {
    const data = await this.ddbClient.scan({
      TableName: this.orderDdb,
    }).promise();

    return data.Items as Order[];
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    const data = await this.ddbClient.query({
      TableName: this.orderDdb,
      KeyConditionExpression: 'pk = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    }).promise();

    return data.Items as Order[];
  };

  async getOrder(email: string, orderId: string): Promise<Order> {
    const data = await this.ddbClient.get({
      TableName: this.orderDdb,
      Key: {
        pk: email,
        sk: orderId,
      },
    }).promise();

    if (!data.Item) {
      throw new Error('Order not found');
    }

    return data.Item as Order;
  }

  async deleteOrder(email: string, orderId: string): Promise<Order> {
    const data = await this.ddbClient.delete({
      TableName: this.orderDdb,
      Key: {
        pk: email,
        sk: orderId,
      },
      ReturnValues: 'ALL_OLD',
    }).promise();

    if (!data.Attributes) {
      throw new Error('Order not found');
    }

    return data.Attributes as Order;
  }
}

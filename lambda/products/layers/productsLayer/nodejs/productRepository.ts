import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { v4 as uuidv4 } from 'uuid';

export interface Product {
  id: string;
  productName: string;
  code: string;
  price: number;
  model: string;
}

export class ProductRepository {
  private readonly ddbClient: DocumentClient;
  private readonly productsDdb: string;

  constructor(ddbClient: DocumentClient, productsDdb: string) {
    this.ddbClient = ddbClient;
    this.productsDdb = productsDdb;
  }

  async getAllProducts(): Promise<Product[]> {
    const params: DocumentClient.GetItemInput = {
      TableName: this.productsDdb,
      Key: {}
    };

    const result = await this.ddbClient.scan(params).promise();
    return result.Items as Product[];
  }

  async getProductById(id: string): Promise<Product> {
    const params: DocumentClient.GetItemInput = {
      TableName: this.productsDdb,
      Key: {
        id,
      },
    };

    const data = await this.ddbClient.get(params).promise();

    if (!data.Item) {
      throw new Error(`Product with id ${id} not found`);
    }

    return data.Item as Product;
  }

  async createProduct(product: Product): Promise<Product> {
    const params: DocumentClient.PutItemInput = {
      TableName: this.productsDdb,
      Item: {
        ...product,
        id: uuidv4(),
      },
    };

    const data = await this.ddbClient.put(params).promise();
    return data.$response.data as Product;
  }

  async updateProduct(productId: string, product: Product): Promise<Product> {
    const params: DocumentClient.UpdateItemInput = {
      TableName: this.productsDdb,
      Key: {
        id: productId,
      },
      ConditionExpression: 'attribute_exists(id)',
      UpdateExpression: 'set productName = :productName, code = :code, price = :price, model = :model',
      ExpressionAttributeValues: {
        ':productName': product.productName,
        ':code': product.code,
        ':price': product.price,
        ':model': product.model,
      },
      ReturnValues: 'UPDATED_NEW',
    };

    const data = await this.ddbClient.update(params).promise();

    if (!data.Attributes) {
      throw new Error(`Product with id ${product.id} not found`);
    }

    return data.Attributes as Product;
  }

  async deleteProduct(id: string): Promise<Product> {
    const params: DocumentClient.DeleteItemInput = {
      TableName: this.productsDdb,
      Key: {
        id,
      },
      ReturnValues: 'ALL_OLD',
    };

    const data = await this.ddbClient.delete(params).promise();

    if (!data.Attributes) {
      throw new Error(`Product with id ${id} not found`);
    }

    return data.Attributes as Product;
  }
}
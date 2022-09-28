import { ApiGatewayManagementApi } from "aws-sdk";

export class InvoiceWsService {
  private apiGwManagementApi: ApiGatewayManagementApi;

  constructor(apiGwManagementApi: ApiGatewayManagementApi) {
    this.apiGwManagementApi = apiGwManagementApi;
  }

  private async getConnection(connectionId: string): Promise<ApiGatewayManagementApi.GetConnectionResponse> {
    return await this.apiGwManagementApi.getConnection({
      ConnectionId: connectionId,
    }).promise();
  }

  sendInvoiceStatus(transactionId: string, connectionId: string, status: string): Promise<boolean> {
    const postData = JSON.stringify({
      transactionId,
      status,
    });

    return this.sendData(connectionId, postData);
  }

  async disconnetClient(connectionId: string): Promise<boolean> {
    try {
      this.getConnection(connectionId)

      await this.apiGwManagementApi.deleteConnection({
        ConnectionId: connectionId,
      }).promise();

      return true;
    } catch (error) {
      console.error(`${error}`);
      return false;
    }
  }

  async sendData(connectionId: string, data: string): Promise<boolean> {
    try {
      this.getConnection(connectionId)

      await this.apiGwManagementApi.postToConnection({
        ConnectionId: connectionId,
        Data: data,
      }).promise();

      return true;
    } catch (error) {
      console.error(`${error}`);
      return false;
    }
  };


}
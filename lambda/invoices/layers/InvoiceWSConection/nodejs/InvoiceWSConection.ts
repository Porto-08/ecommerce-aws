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
  }
}
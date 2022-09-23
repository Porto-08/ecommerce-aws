import * as cdk from 'aws-cdk-lib'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as cwlogs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

interface EcommerceApiStackProps extends cdk.StackProps {
  productsFetchHandler: lambdaNodeJs.NodejsFunction
  productsAdminHandler: lambdaNodeJs.NodejsFunction
  ordersHandler: lambdaNodeJs.NodejsFunction
  ordersEventsFetchHandler: lambdaNodeJs.NodejsFunction
}

export class EcommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcommerceApiStackProps) {
    super(scope, id, props);

    const logGroup = new cwlogs.LogGroup(this, 'EcommerceApiLogs');

    const api = new apiGateway.RestApi(this, 'EcommerceApi', {
      restApiName: 'EcommerceApi',
      description: 'This service serves the Ecommerce API.',
      deployOptions: {
        accessLogDestination: new apiGateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apiGateway.AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          protocol: true,
          ip: true,
          requestTime: true,
          resourcePath: true,
          status: true,
          responseLength: true,
          caller: true,
          user: true,
        }),
      },
      cloudWatchRole: true,
    });

    // ----- Products -----
    this.createProductService(props, api);

    // ----- Orders -----
    this.createOrdersService(props, api);

  };

  private createOrdersService(props: EcommerceApiStackProps, api: apiGateway.RestApi) {
    const ordersIntegration = new apiGateway.LambdaIntegration(props.ordersHandler);
    const ordersResource = api.root.addResource('orders');

    // GET /orders
    // GET /orders?email=samuel@emial.com
    // GET /orders?email=samuel@email&orderId=123
    ordersResource.addMethod('GET', ordersIntegration);


    // DELETE /orders?email=samuel@email&orderId=123
    const orderDeletionValidator = new apiGateway.RequestValidator(this, 'OrderDeletionValidator', {
      restApi: api,
      requestValidatorName: 'OrderDeletionValidator',
      validateRequestParameters: true,
    });

    ordersResource.addMethod('DELETE', ordersIntegration, {
      requestParameters: {
        'method.request.querystring.email': true,
        'method.request.querystring.orderId': true,
      },
      requestValidator: orderDeletionValidator,
    });

    // POST /orders
    const orderRequestValidator = new apiGateway.RequestValidator(this, 'OrderRequestValidator', {
      restApi: api,
      requestValidatorName: 'OrderRequestValidator',
      validateRequestBody: true,
    });

    const orderModel = new apiGateway.Model(this, "OrderModel", {
      modelName: "OrderModel",
      restApi: api,
      schema: {
        type: apiGateway.JsonSchemaType.OBJECT,
        properties: {
          email: {
            type: apiGateway.JsonSchemaType.STRING
          },
          productIds: {
            type: apiGateway.JsonSchemaType.ARRAY,
            minItems: 1,
            items: {
              type: apiGateway.JsonSchemaType.STRING
            }
          },
          payment: {
            type: apiGateway.JsonSchemaType.STRING,
            enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD"]
          }
        },
        required: [
          "email",
          "productIds",
          "payment"
        ]
      }
    });

    ordersResource.addMethod("POST", ordersIntegration, {
      requestValidator: orderRequestValidator,
      requestModels: {
        "application/json": orderModel
      }
    });

    // GET /orders/events
    const ordersEventsResource = ordersResource.addResource('events');

    const orderEventsFetchValidator = new apiGateway.RequestValidator(this, 'OrderEventsFetchValidator', {
      restApi: api,
      requestValidatorName: 'OrderEventsFetchValidator',
      validateRequestParameters: true,
    });

    const orderEventsFetchIntegration = new apiGateway.LambdaIntegration(props.ordersEventsFetchHandler);

    // GET /orders/events?email=samuel@email
    // GET /orders/events?email=samuel@email&eventType=ORDER_CREATED
    ordersEventsResource.addMethod('GET', orderEventsFetchIntegration, {
      requestValidator: orderEventsFetchValidator,
      requestParameters: {
        'method.request.querystring.email': true,
        'method.request.querystring.eventType': false,
      },
    });
  }

  private createProductService(props: EcommerceApiStackProps, api: apiGateway.RestApi) {
    const productsFetchIntegration = new apiGateway.LambdaIntegration(props.productsFetchHandler);

    // GET /products
    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', productsFetchIntegration);

    // GET /products/{id}
    const productIdResource = productsResource.addResource('{id}');
    productIdResource.addMethod('GET', productsFetchIntegration);

    // ADMIN METHODS
    const productsAdminIntegration = new apiGateway.LambdaIntegration(props.productsAdminHandler);

    // POST /products
    const productRequestValidator = new apiGateway.RequestValidator(this, 'ProductRequestValidator', {
      restApi: api,
      requestValidatorName: 'ProductRequestValidator',
      validateRequestBody: true,
    });

    const productSchema = {
      type: apiGateway.JsonSchemaType.OBJECT,
      properties: {
        productName: {
          type: apiGateway.JsonSchemaType.STRING
        },
        code: {
          type: apiGateway.JsonSchemaType.STRING
        },
        price: {
          type: apiGateway.JsonSchemaType.NUMBER
        },
        model: {
          type: apiGateway.JsonSchemaType.STRING
        },
        productUrl: {
          type: apiGateway.JsonSchemaType.STRING
        },
      },
      required: [
        "productName",
        "code",
        "price",
        "model",
        "productUrl"
      ],
    }

    const productModel = new apiGateway.Model(this, 'ProductModel', {
      modelName: 'ProductModel',
      restApi: api,
      schema: productSchema,
    });

    productsResource.addMethod('POST', productsAdminIntegration, {
      requestValidator: productRequestValidator,
      requestModels: {
        'application/json': productModel
      }
    });

    // PUT /products/{id}

    const productPutModel = new apiGateway.Model(this, 'ProductPutModel', {
      modelName: 'ProductPutModel',
      restApi: api,
      schema: {
        ...productSchema,
        required: ['price']
      }
    });

    productIdResource.addMethod('PUT', productsAdminIntegration, {
      requestValidator: productRequestValidator,
      requestModels: {
        'application/json': productPutModel
      }
    });

    // DELETE /products/{id}
    productIdResource.addMethod('DELETE', productsAdminIntegration);
  }
};
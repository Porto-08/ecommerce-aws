import * as cdk from 'aws-cdk-lib'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as cwlogs from 'aws-cdk-lib/aws-logs'
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

interface EcommerceApiStackProps extends cdk.StackProps {
  productsFetchHandler: lambdaNodeJs.NodejsFunction
  productsAdminHandler: lambdaNodeJs.NodejsFunction
  ordersHandler: lambdaNodeJs.NodejsFunction
  ordersEventsFetchHandler: lambdaNodeJs.NodejsFunction
}

export class EcommerceApiStack extends cdk.Stack {
  private productAuthorizer: apiGateway.CognitoUserPoolsAuthorizer;
  private productAdminAuthorizer: apiGateway.CognitoUserPoolsAuthorizer;
  private customerPool: cognito.UserPool;
  private adminPool: cognito.UserPool;

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

    // ----- Cognito -----
    this.createCognitoAuth();

    // ----- Products -----
    this.createProductService(props, api);

    // ----- Orders -----
    this.createOrdersService(props, api);

  };

  private createCognitoAuth() {
    // lambda trigger
    const postConfirmationHandler = new lambdaNodeJs.NodejsFunction(this, 'PostConfirmationFunction', {
      functionName: 'PostConfirmationFunction',
      entry: 'lambda/auth/postConfirmationFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });

    const preAuthenticationHandler = new lambdaNodeJs.NodejsFunction(this, 'PreAuthenticationFunction', {
      functionName: 'PreAuthenticationFunction',
      entry: 'lambda/auth/preAuthenticationFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });



    // cognito customer UserPool
    this.customerPool = new cognito.UserPool(this, "CustomerPool", {
      lambdaTriggers: {
        postConfirmation: postConfirmationHandler,
        preAuthentication: preAuthenticationHandler,
      },
      userPoolName: "CustomerPool",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      autoVerify: {
        email: true,
        phone: false,
      },
      userVerification: {
        emailSubject: "Verify your email for the ECommerce Service!",
        emailBody: "Thanks for signing up to ECommerce service! Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      signInAliases: {
        username: false,
        email: true,
      },
      standardAttributes: {
        fullname: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3)
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // Cognito admin UserPool 
    this.adminPool = new cognito.UserPool(this, "AdminPool", {
      lambdaTriggers: {
        postConfirmation: postConfirmationHandler,
        preAuthentication: preAuthenticationHandler,
      },
      userPoolName: "AdminPool",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      userInvitation: {
        emailSubject: "Welcome to ECommerce administrator",
        emailBody: 'Your email is {username} and temporary password is {####}.'
      },
      signInAliases: {
        username: false,
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3)
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });


    this.customerPool.addDomain('CustomerDomain', {
      cognitoDomain: {
        domainPrefix: 'spa-customer-service',
      },
    })

    this.adminPool.addDomain('AdminDomain', {
      cognitoDomain: {
        domainPrefix: 'spa-admin-service',
      },
    })

    // customer scope
    const customerWebScope = new cognito.ResourceServerScope({
      scopeName: 'web',
      scopeDescription: "Customer web operations"
    });

    const customerMobileScope = new cognito.ResourceServerScope({
      scopeName: 'mobile',
      scopeDescription: "Customer mobile operations"
    });

    // admin scope
    const adminWebScope = new cognito.ResourceServerScope({
      scopeName: 'web',
      scopeDescription: "Admin web operations"
    });

    // customer resource server
    const customerResourceServer = this.customerPool.addResourceServer("CustomerResourceServer", {
      identifier: "customer",
      userPoolResourceServerName: "CustomerResourceServer",
      scopes: [customerWebScope, customerMobileScope]
    });

    // admin resource server
    const adminResourceServer = this.adminPool.addResourceServer("AdminResourceServer", {
      identifier: "admin",
      userPoolResourceServerName: "AdminResourceServer",
      scopes: [adminWebScope]
    });

    // customer clients
    this.customerPool.addClient("customer-web-client", {
      userPoolClientName: "customerWebClient",
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(customerResourceServer, customerWebScope)],
      }
    });

    this.customerPool.addClient("customer-mobile-client", {
      userPoolClientName: "customerMobileClient",
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(customerResourceServer, customerMobileScope)],
      }
    });

    // admin clients
    this.adminPool.addClient("admin-web-client", {
      userPoolClientName: "adminWebClient",
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(adminResourceServer, adminWebScope)],
      }
    });

    this.productAuthorizer = new apiGateway.CognitoUserPoolsAuthorizer(this, "ProductsAuthorizer", {
      authorizerName: "ProductsAuthorizer",
      cognitoUserPools: [this.customerPool, this.adminPool]
    });

    this.productAdminAuthorizer = new apiGateway.CognitoUserPoolsAuthorizer(this, "ProductsAdminAuthorizer", {
      authorizerName: "ProductsAdminAuthorizer",
      cognitoUserPools: [this.adminPool]
    });
  }

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

    const productFetchWebMobileIntegrationOption: cdk.aws_apigateway.MethodOptions = {
      authorizer: this.productAuthorizer,
      authorizationType: apiGateway.AuthorizationType.COGNITO,
      authorizationScopes: ['customer/web', 'customer/mobile']
    }

    const productFetchMobileIntegrationOption: cdk.aws_apigateway.MethodOptions = {
      authorizer: this.productAuthorizer,
      authorizationType: apiGateway.AuthorizationType.COGNITO,
      authorizationScopes: ['customer/web']
    }

    // GET /products
    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', productsFetchIntegration, productFetchWebMobileIntegrationOption);

    // GET /products/{id}
    const productIdResource = productsResource.addResource('{id}');
    productIdResource.addMethod('GET', productsFetchIntegration, productFetchMobileIntegrationOption);

    // ADMIN METHODS
    const productsAdminIntegration = new apiGateway.LambdaIntegration(props.productsAdminHandler);

    // Admin autorizer options
    const productAdminWebIntegrationOption: cdk.aws_apigateway.MethodOptions = {
      authorizer: this.productAdminAuthorizer,
      authorizationType: apiGateway.AuthorizationType.COGNITO,
      authorizationScopes: ['admin/web']
    }

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
      },
      ...productAdminWebIntegrationOption
    });

    // PUT /products/{id}

    const productPutModel = new apiGateway.Model(this, 'ProductPutModel', {
      modelName: 'ProductPutModel',
      restApi: api,
      schema: {
        ...productSchema,
        required: ['price']
      },
      ...productAdminWebIntegrationOption
    });

    productIdResource.addMethod('PUT', productsAdminIntegration, {
      requestValidator: productRequestValidator,
      requestModels: {
        'application/json': productPutModel
      },
      ...productAdminWebIntegrationOption
    });

    // DELETE /products/{id}
    productIdResource.addMethod('DELETE', productsAdminIntegration, productAdminWebIntegrationOption);
  }
};
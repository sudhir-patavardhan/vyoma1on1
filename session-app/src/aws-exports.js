const awsConfig = {
    Auth: {
      region: "us-east-1", // Replace with your AWS region
      userPoolId: "us-east-1_MYgj1LsPS", // Your Cognito User Pool ID
      userPoolWebClientId: "2fpemjqos4302bfaf65g06l8g0", // Your Cognito App Client ID
      oauth: {
        domain: "auth.sessions.red", // Your Cognito domain
        scope: ["openid", "email", "profile", "phone"],
        redirectSignIn: "http://localhost:3000/",
        redirectSignOut: "http://localhost:3000/",
        responseType: "code", // For Authorization Code Grant
      },
    },
  };
  
  export default awsConfig;
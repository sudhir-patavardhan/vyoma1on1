const awsConfig = {
    Auth: {
      region: "ap-south-1", // AWS region
      userPoolId: "ap-south-1_ghMdyIY2D", // Updated Cognito User Pool ID
      userPoolWebClientId: "4rkke6o1h98p3judjga7m34lrn", // Updated Cognito App Client ID
      oauth: {
        domain: "auth.yoursanskritteacher.com", // Cognito domain
        scope: ["phone", "openid", "email"],
        redirectSignIn: "https://yoursanskritteacher.com",
        redirectSignOut: "https://yoursanskritteacher.com",
        responseType: "code", // For Authorization Code Grant
      },
    },
  };
  
  export default awsConfig;
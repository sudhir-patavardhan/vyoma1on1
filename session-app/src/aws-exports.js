const awsConfig = {
    Auth: {
      region: "us-east-1", // AWS region
      userPoolId: "us-east-1_US1m8498L", // Updated Cognito User Pool ID
      userPoolWebClientId: "12s8brrk9144uq23g3951mfvhl", // Updated Cognito App Client ID
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
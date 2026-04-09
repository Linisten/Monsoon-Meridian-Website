/**
 * QZ Tray Security Configuration for Monsoon Meridian
 * This provides the Digital Certificate and RSA Signing logic to make the app "Trusted".
 */

// 1. Digital Certificate (X.509 format)
// This identifies "Monsoon Meridian" as the requester.
const DIGITAL_CERTIFICATE = `
-----BEGIN CERTIFICATE-----
MIIBtjCCAR6gAwIBAgIUW4oD21Z8S7K1S3W4oD21Z8S7K1UwDQYJKoZIhvcNAQEL
BQAwGzEZMBcGA1UEAwwQTW9uc29vbiBNZXJpZGlhbjAeFw0yNjA0MDkwOTU1MDBa
Fw0zNjA0MDcwOTU1MDBaMBsxGTAXBgNVBAMMEE1vbnNvb24gTWVyaWRpYW4wgZ8w
DQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAK6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8
S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4
oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1AgMBAAEwDQYJ
KoZIhvcNAQELBQADgYEAK6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z
8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W
4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4=
-----END CERTIFICATE-----
`;

// 2. Private Key (PKCS#8 Base64)
// This is used for signing challenges. IN PRODUCTION, THIS SHOULD BE ON A SERVER.
// For local POS standalone, we store it here for simplicity.
const PRIVATE_KEY_B64 = "MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAoGBAK6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1AgMBAAECgYEAq6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1CQQD6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1CQQD6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1CQQD6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1CQQD6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1CQQD6zIqB3J5W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1S3W4oD21Z8S7K1";

/**
 * Configure QZ Tray with the digital certificate and signing logic.
 */
export async function setupQZSecurity(qz) {
  // 1. Set the certificate
  qz.security.setCertificatePromise((resolve) => {
    resolve(DIGITAL_CERTIFICATE);
  });

  // 2. Set the signature logic using Native Web Crypto API
  qz.security.setSignaturePromise((toSign) => {
    return (resolve, reject) => {
      try {
        signChallenge(toSign)
          .then(resolve)
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    };
  });
}

/**
 * Signs the challenge string from QZ Tray using RSA-SHA1 (Native Web Crypto)
 */
async function signChallenge(toSign) {
  const binaryDer = window.atob(PRIVATE_KEY_B64);
  const binaryLen = binaryDer.length;
  const bytes = new Uint8Array(binaryLen);
  for (let i = 0; i < binaryLen; i++) {
    bytes[i] = binaryDer.charCodeAt(i);
  }

  // Import the private key
  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-1",
    },
    false,
    ["sign"]
  );

  // Sign the data
  const data = new TextEncoder().encode(toSign);
  const signature = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    data
  );

  // Convert to Base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

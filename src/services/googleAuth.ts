// Service Account Credentials provided for Google Sheets API integration
const SERVICE_ACCOUNT_EMAIL = 'skip-service-account@skip-507216.iam.gserviceaccount.com'

const SERVICE_ACCOUNT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDDsYLJzVv6c30H
GeGeNri8tH/kmNj1a3ZgMDv0B8bF5SDh6NVpcTfOYcPfxrjFsira9uQtnZhKL8Ct
Ddc4iFgBbbqVxLRZgBaPXXiYhBldZaB7DyjK7jral3GQZaYBZrsCE+lEAhmeOIL4
+0lAEeLUipB/rlQI9kOLcbuTqv8enUbyMYXKxnPqJNgGEyfeCMdzEOsoivqhriSw
E8PGMzHjOCRPPx0RCWphMjrbCGFpcNORoOf2xhTnLbV83xgWhaOPjjlwZSkwVDmY
olvls81XIM3RREWVdvAewhyCb0XaZP0OHCFKHGccBDzRLKW8bJL97HuqfYHlSXZp
EYWlm30tAgMBAAECggEARvNH+QSUsYRHs1hl3af3aKuEpwvntWtF2vAB/KMJJVzC
hEWXgohC9Hervald+odzVDopVoSJ33PaxqN7AYslZTc0a/KKdNyk0UvRWnKig6NC
APvpDVI8Ul6QFQtVmbJ2YPV5IGgmg5/3lG//CdSySd8HLtO0sh8fNCKDILHhl2ZJ
QhWWJB1zIePq1S/Yt0wMkMR+L5MG7I2NzGBR3f5x8I8tKvS3ulVc7H4fE0Z+16wY
s31mbzdfXX1N/9owV1qjxUlxKCwwOc3Ey2dbRTjadEMBQbaUlr3ruOtbVAAjx1FC
r7Nq6gaa2nq6wYfy2jyufNHueahVlKqsB/K4oC4j3QKBgQD5OwCVk1I17d6FDT5y
K4lBzuvz/RHmOTdtYvHdiYmv0adBEhhu55YlxRHvDr1Ouq5uveN3/Gl66tibQ47Z
a9RAwSJfkK51L8BL5l/6zXBIY0rMT4zJw2rKFC6AzdtrdoPlj+8LSHv+MII67g/S
VTVoL7pdveth+mNlGqxH9tqHwwKBgQDJAj6FmcrZ71AnJzdbbnaPQOekAUIgjgnE
FzqiPTgR3lspLpYAEKMJdl+sVBI/9rrkIvs6FHrZODIzSExJ5e2ndXKZ/846qoE3
7VIMUa1E6+8HOE4Dn20IptSYFNv/dVqtA6dPVG39MLPjZOCYYaZ/WqP70XRt2Hj2
hrlxqwSITwKBgQDOFiv1g0yHq5pFCx6H6dglwqT5rFoQtV9P5HF7by+bYxGajQwH
KRjPQpYBx35ii5uRlxNxNBdEvM1AFi0ZPEDXCt0RiOG5pTKtkGHtUdN3CCPhriYM
8LptPyL0/0RhKC8ItGxGODnPhu0pLZGHq03uSQkiWtk4u4NVJykumME7YQKBgQDE
+bwG9ASCuC8VjyqCIKdyDipw3wLMICSV0iWVIuS1Le6rVomLmsIJ3cQ3fVM89y2B
rn3+Fl+kSZt4AZswt27CMSeSncicWMWz5o4GoGtpJMLhkl1w02PnnISsW5SSq4+m
B/SGmrgF6xn89bfZ26drGYmklUbA9ebjvnYvW2VfpQKBgB9ghJvG97onn9Sf4zQf
IiaM3KR3cGXS0VNqPEzyMy0WOiVx/xQovDPHQerCnnKnbGFWjTQwBID7Dp66nSXA
54wHPdqtddO8HRDWgmTF/SO6IcyDk0lCvGflRdOvBsi7SVpH7CJFMTFCAiVkNayS
/ckSCUVC6MiYu+YTrUFIrjzh
-----END PRIVATE KEY-----`

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

// Helper functions for WebCrypto JWT signing
function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function objectToBase64Url(obj: any): string {
  const jsonStr = JSON.stringify(obj)
  const utf8Bytes = new TextEncoder().encode(jsonStr)
  let binary = ''
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i])
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Gets a fresh OAuth2 access token for Google Sheets API using Service Account JWT assertion.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const nowSecs = Math.floor(Date.now() / 1000)

  // Use cached token if still valid for >60s
  if (cachedToken && cachedToken.expiresAt > nowSecs + 60) {
    return cachedToken.accessToken
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const claimSet = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    exp: nowSecs + 3600,
    iat: nowSecs,
  }

  const encodedHeader = objectToBase64Url(header)
  const encodedClaimSet = objectToBase64Url(claimSet)
  const unsignedAssertion = `${encodedHeader}.${encodedClaimSet}`

  // Clean PEM private key
  const cleanKey = SERVICE_ACCOUNT_PRIVATE_KEY.replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/(\r\n|\n|\r|\s)/gm, '')

  const binaryDer = str2ab(atob(cleanKey))

  const cryptoKey = await window.crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['sign'],
  )

  const signatureBuffer = await window.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedAssertion),
  )

  const encodedSignature = arrayBufferToBase64Url(signatureBuffer)
  const signedJwt = `${unsignedAssertion}.${encodedSignature}`

  const params = new URLSearchParams()
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  params.append('assertion', signedJwt)

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Falha na autenticação Google OAuth: HTTP ${res.status} - ${errText}`)
  }

  const data = await res.json()
  if (!data.access_token) {
    throw new Error('Google OAuth não retornou access_token')
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: nowSecs + (data.expires_in || 3600),
  }

  return data.access_token
}

export interface SpreadsheetMetadata {
  spreadsheetId: string
  title: string
  sheets: { title: string; sheetId: number }[]
}

/**
 * Fetches metadata about the spreadsheet to verify accessibility and sheet/tab titles.
 */
export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
  const token = await getGoogleAccessToken()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}?fields=spreadsheetId,properties.title,sheets.properties`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    let errorDetail = ''
    try {
      const errJson = await res.json()
      errorDetail = errJson?.error?.message || JSON.stringify(errJson)
    } catch {
      errorDetail = await res.text()
    }

    if (res.status === 403) {
      throw new Error(
        `Permissão negada (HTTP 403): A planilha "${spreadsheetId}" não foi compartilhada com a Conta de Serviço. Compartilhe com "${SERVICE_ACCOUNT_EMAIL}" como Editor. Detalhe: ${errorDetail}`,
      )
    }

    if (res.status === 404) {
      throw new Error(
        `Planilha não encontrada (HTTP 404): Verifique o ID/link da planilha "${spreadsheetId}". Detalhe: ${errorDetail}`,
      )
    }

    throw new Error(`Google Sheets API erro HTTP ${res.status}: ${errorDetail}`)
  }

  const data = await res.json()
  const title = data.properties?.title || 'Planilha'
  const sheets = Array.isArray(data.sheets)
    ? data.sheets.map((s: any) => ({
        title: s.properties?.title || 'Sheet1',
        sheetId: s.properties?.sheetId || 0,
      }))
    : []

  return {
    spreadsheetId,
    title,
    sheets,
  }
}

/**
 * Appends a row of values to a Google Sheet spreadsheet via Google Sheets API v4.
 * Uses range 'A1' or sheet-specific range.
 */
export async function appendRowToGoogleSheet(
  spreadsheetId: string,
  rowValues: (string | number)[],
  range?: string,
): Promise<{ updatedRange: string; updatedRows: number; targetSheetTitle?: string }> {
  const token = await getGoogleAccessToken()

  // If no explicit range provided, try to detect the first sheet title for accurate appending
  let targetRange = range
  let targetSheetTitle = ''

  if (!targetRange) {
    try {
      const meta = await getSpreadsheetMetadata(spreadsheetId)
      if (meta.sheets.length > 0) {
        targetSheetTitle = meta.sheets[0].title
        // Quote tab name if it has spaces or special characters
        const safeTitle =
          targetSheetTitle.includes(' ') || targetSheetTitle.includes("'")
            ? `'${targetSheetTitle.replace(/'/g, "''")}'`
            : targetSheetTitle
        targetRange = `${safeTitle}!A1`
      } else {
        targetRange = 'A1'
      }
    } catch (e: any) {
      console.warn('[GoogleAuth] Metadata lookup failed, falling back to A1 range:', e?.message)
      targetRange = 'A1'
    }
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}/values/${encodeURIComponent(targetRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const body = {
    range: targetRange,
    majorDimension: 'ROWS',
    values: [rowValues],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errorDetail = ''
    try {
      const errJson = await res.json()
      errorDetail = errJson?.error?.message || JSON.stringify(errJson)
    } catch {
      errorDetail = await res.text()
    }

    if (res.status === 403) {
      throw new Error(
        `Permissão negada (HTTP 403): A planilha "${spreadsheetId}" não foi compartilhada com a Conta de Serviço. Compartilhe com "${SERVICE_ACCOUNT_EMAIL}" como Editor. Detalhe: ${errorDetail}`,
      )
    }

    if (res.status === 404) {
      throw new Error(
        `Planilha não encontrada (HTTP 404): Verifique o ID/link da planilha "${spreadsheetId}". Detalhe: ${errorDetail}`,
      )
    }

    throw new Error(`Google Sheets API erro HTTP ${res.status}: ${errorDetail}`)
  }

  const data = await res.json()
  return {
    updatedRange: data.updates?.updatedRange || '',
    updatedRows: data.updates?.updatedRows || 1,
    targetSheetTitle,
  }
}

export const googleServiceAccountConfig = {
  clientEmail: SERVICE_ACCOUNT_EMAIL,
}

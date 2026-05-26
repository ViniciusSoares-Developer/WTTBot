import * as fs from "node:fs";
import {google} from "googleapis";
import dotenv from "dotenv";
import path from "node:path";
import * as readline from "node:readline";

interface ICredential {
    installed: {
        client_id: string
        project_id: string
        auth_uri: string
        token_uri: string
        auth_provider_x509_cert_url: string
        client_secret: string
        redirect_uris: Array<string>
    }
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
const TOKEN_PATH = path.join(process.cwd(), 'token.json')
const CREDENTIAL_PATH = path.join(process.cwd(), 'credential.json')

export default class GoogleApiLib {
    async authorize() {
        const credentials: ICredential = JSON.parse(fs.readFileSync(CREDENTIAL_PATH, "utf8"));
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

        if (fs.existsSync(TOKEN_PATH)) {
            const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"))
            oAuth2Client.setCredentials(token);
            return oAuth2Client;
        }

        const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES })
        console.log('[GOOGLE] -> Authorize to visit:\n', authUrl)

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const code = await new Promise<string>((resolve) => rl.question('\\nEnter the code from that page: ', resolve))
        rl.close()

        const { tokens } = await oAuth2Client.getToken(code)
        oAuth2Client.setCredentials(tokens)

        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('[GOOGLE] -> token storage')

        return oAuth2Client
    }

    async getSheetData(spreadsheetId: string, range: string, hasHeader = true) {
        const auth = await this.authorize();
        const sheets = google.sheets({ version: 'v4', auth })

        if (!new RegExp(/^(?:'[^']+'|[^!]+)![A-Z]+\d+:[A-Z]+\d+$/).test(range)) {
            console.error('[GOOGLE] -> Invalid format range: ', range)
            return
        }

        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range })

        const rows = response.data.values
        if (!rows || rows.length === 0) {
            console.error('[GOOGLE] -> No data found')
            return
        }

        if (hasHeader) {
            const [headers, ...data] = rows
            return {
                spreadsheetId,
                rows: data.map((row) =>
                    Object.fromEntries(headers!.map((header, i) => [header ?? `col_${i}`, row[i] ?? null]))
                ).flat()
            }
        }

        return {
            spreadsheetId,
            rows: rows.flat()
        };
    }
}
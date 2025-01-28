import { DexScreenerAPI } from '../src/dexscreener-service'

const dexScreenerAPI = new DexScreenerAPI()

async function fetchApi(token: string) {
  const data = await dexScreenerAPI.findTokenBySymbol(token)
  console.log('FETCHING : ' + token)
  console.log('data', data)
  console.log('token name', data?.name)
  console.log('website', data?.links[0]?.url)
  console.log('================================================================================')
}

fetchApi('SERV')
fetchApi('AIXBT')
fetchApi('WrongTOKEN')

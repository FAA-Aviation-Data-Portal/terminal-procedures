const Promise = require('bluebird')
const request = Promise.promisify(require('request'))
const cheerio = require('cheerio')

// Provide a shortcut to the list method
const terminalProcedures = module.exports = (icaos, options = {}) => {
  return terminalProcedures.list(icaos, options)
}

// Main listing method; accepts one or more ICAO codes
terminalProcedures.list = (icaos, options = {}) => {
  if (Array.isArray(icaos)) {
    return Promise.all(icaos.map(listOne))
  }
  return listOne(icaos)
}

const fetchCurrentCycle = terminalProcedures.fetchCurrentCycle = () => request('https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/')
  .then(res => {
    const $ = cheerio.load(res.body)
    return $('select#cycle > option:contains(Current)').val()
  })

const listOne = async icao => {
  const searchCycle = await fetchCurrentCycle()
  let procedures = []
  let lastPageFetched = 0
  let lastNumFetched = 1
  while (lastNumFetched > 0) {
    const page = await request(`https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/?cycle=${searchCycle}&ident=${icao}&sort=type&dir=asc&page=${lastPageFetched + 1}`)
      .then(res => parse(res.body))
    if (page) {
      lastNumFetched = page.length
      lastPageFetched += 1
      procedures = procedures.concat(page)
    } else {
      break
    }
  }
  return procedures
}

// Parse the response HTML
const parse = (html) => {
  const $ = cheerio.load(html)
  const $resultsTable = $('#resultsTable')

  if (!$resultsTable.html()) {
    return null
  }

  const results = $resultsTable.find('tr').toArray().map(row => {
    const $row = $(row)
    const type = $row.find('td:nth-child(7)').text().trim()

    if (!type) {
      return null
    }

    const state = $row.find('td:nth-child(1)').text().trim()
    const city = $row.find('td:nth-child(2)').text().trim()
    const airport = $row.find('td:nth-child(3)').text().trim()
    const ident = $row.find('td:nth-child(4)').text().trim()
    const vol = $row.find('td:nth-child(5)').text().trim()
    const flag = $row.find('td:nth-child(6)').text().trim()
    const procedure = {
      name: $row.find('td:nth-child(8)').text().trim(),
      url: $row.find('td:nth-child(8)').find('a').attr('href')
    }
    const compare = {
      name: $row.find('td:nth-child(9)').text().trim(),
      url: $row.find('td:nth-child(9)').find('a').attr('href')
    }

    return {
      state,
      city,
      airport,
      ident,
      vol,
      flag,
      type,
      procedure,
      compare
    }
  }).filter(x => !!x)

  if (results.length > 0) {
    return results
  }
  return null
}

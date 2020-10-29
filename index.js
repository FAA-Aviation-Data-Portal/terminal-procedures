const cheerio = require('cheerio')
const superagent = require('superagent')

const BASE_URL =
  'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search'

// For some reason the server takes forever to respond without this request header
const ACCEPT = 'text/html'

const defaultQueryOptions = {
  flag: [], // 'A' - Added, 'C' - Changed, 'D' - Deleted, Empty - All valid procedures
  getNextCycle: false // `false` do not get the 'Next' cycle, only get the 'Current' cycle; `true` get the 'Next' cycle if available
}

/**
 *  A shortcut to the list() method
 */
const terminalProcedures = (module.exports = (icaos, options = defaultQueryOptions) => {
  return terminalProcedures.list(icaos, options)
})

/**
 * Main fetching method; accepts one or more ICAO codes
 */
terminalProcedures.list = (icaos, options = defaultQueryOptions) => {
  if (Array.isArray(icaos)) {
    return Promise.all(icaos.map(icao => listOne(icao, options)))
  }
  return listOne(icaos, options)
}

terminalProcedures.currentCycleEffectiveDates = async () => {
  const response = await superagent
    .get(BASE_URL)
    .set('Accept', ACCEPT)
  
  const $ = cheerio.load(response.text)
  var currentCycle = $('select#cycle > option:contains(Current)').text()
  return parseEffectiveDates(currentCycle.replace(/(\n|\t)/gm, ''))
} 

/**
 * Returns the text and values of the targeted <select/> element
 * @param {string} cycle - The target cycle to retrieve. Valid values are 'Current' or 'Next'
 */
const fetchCycle = async (cycle = 'Current') => {
  // Only all the values 'Current' or 'Next'
  if (cycle !== 'Current' && cycle !== 'Next') {
    cycle = 'Current'
  }
  const response = await superagent
    .get(BASE_URL)
    .set('Accept', ACCEPT)
  
  const $ = cheerio.load(response.text)
  const $cycle = $(`select#cycle > option:contains(${cycle})`)
  if (!$cycle) {
    return $cycle
  }
  return {
    text: $cycle.text(),
    val: $cycle.val()
  }
}

/**
 * Returns the text and values of the targeted <select/> element
 * @param {string} cycle - The target cycle to retrieve. Valid values are 'Current' or 'Next'
 */
terminalProcedures.fetchCycle = fetchCycle

terminalProcedures.getCycleEffectiveDates = async (cycle = 'Current') => {
  const { text: currentCycle, } = await fetchCycle(cycle)
  return parseEffectiveDates(currentCycle.replace(/(\n|\t)/gm, ''))
} 

terminalProcedures.currentCycleEffectiveDates = async () => {
  const { text: currentCycle, } = await fetchCycle()
  if (!currentCycle) {
    console.warn('Could not retrieve current cycle effective dates')
    return
  }
  return parseEffectiveDates(currentCycle.replace(/(\n|\t)/gm, ''))
}

/**
 * Fetch the current diagrams distribution cycle numbers (.e.g, 1813)
 */
const fetchCurrentCycleCode = async () => {
  const cycle = await fetchCycle('Current')
  if (!cycle) {
    console.warn('Current cycle not found or not available.')
    return null
  }
  return cycle.val
}

terminalProcedures.fetchCurrentCycleCode = fetchCurrentCycleCode

/**
 * Fetch the current diagrams distribution cycle numbers (.e.g, 1813)
 */
const fetchNextCycleCode = async () => {
  const cycle = await fetchCycle('Next')
  if (!cycle) {
    console.warn('Next cycle not found or not available. The Next cycle is available 19 days before the end of the current cycle.')
    return null
  }
  return cycle.val
}

terminalProcedures.fetchNextCycleCode = fetchNextCycleCode

/**
 * Using the current cycle, fetch the terminal procedures for a single ICAO code
 * Optionally request only the Added, Created, Deleted, Added and Created, or All procedures
 * @param {String} icao - The Airport Identifier
 * @param {Object} options - One or more options to filter the procedures
 * @returns {Array} - The scraped terminal procedures
 */
const listOne = async (icao, options) => {
  let searchCycle = null
  
  if (options.getNextCycle === true) {
    searchCycle = await fetchNextCycleCode()
  }

  // If the next cycle is not requested, or it is, but it is not
  // available, default to the current cycle
  if (searchCycle === null) {
    if (options.getNextCycle === true) {
      console.warn('Next cycle not available. Retrieving current cycle instead.')
    }
    searchCycle = await fetchCurrentCycleCode()
  }

  // Build up a base set of query params
  let urlParams = [ 'sort=type', 'dir=asc', `ident=${icao}`, ]
  // The searchCycle is optional as the API assumes the latest already
  // and this function uses the latest cycle
  if (searchCycle) {
    urlParams.push(`cycle=${searchCycle}`)
  }

  // Manage these separately than the base `urlParams` since these
  // are used to issue separate requests whereas the `urlParams` are
  // applied to every request
  let filterFlags = []
  // Validate the flag option first 
  if (typeof options === 'object' && Array.isArray(options.flag) && options.flag.length) {
    for (let f = 0, fLen = options.flag.length; f < fLen; f++) {
      switch (options.flag[f].toUpperCase()) {
        case 'A':
          filterFlags.push(`&filterAdded=1`)
          break
        case 'C':
          filterFlags.push(`&filterChanged=1`)
          break
        case 'D':
          filterFlags.push(`&filterDeleted=1`)
          break
        default:
          // Do nothing and just get them all
          filterFlags.push('')
      }
    }
  }
  else {
    // Fallback to just getting them all
    filterFlags.push('')
  }

  // This will be the base url for all requests for all flags for all pages
  const procUrl = `${BASE_URL}/results/?${urlParams.join('&')}`
  const procedures = []

  let i, len, _reqUrl
  // Loop the flags to start getting the procedures for each flag type
  for (i = 0, len = filterFlags.length; i < len; i++) {
    // Set up the base req url for this flag type
    _reqUrl = `${procUrl}${filterFlags[i]}`
    // Issue an initial request without any page param
    let { results, pageCount, } = await getProcedures(_reqUrl)
    if (results.length) {
      // Flatten the results in to the base array that will be returned
      procedures.push(...results)
      // If there are more than one pages of results
      if (pageCount > 1) {
        // Set up a loop to fire of subsequent queries for each remaining page, skipping the first page
        // since that was already requested
        let j
        for (j = 2; j < pageCount; j++) {
          let { results: _results, pageCount: _pageCount } = await getProcedures(`${_reqUrl}&page=${j}`)
          procedures.push(..._results)
          if (_pageCount !== pageCount) {
            pageCount = _pageCount
          }
        }
      }
    }
  }

  return procedures
}

const getProcedures = async url => superagent
  .get(url)
  .set('Accept', ACCEPT)
  .then(res => parse(res.text))

/**
 * Parsing helper methods
 */
const text = ($row, columnIndex) =>
  $row
    .find(`td:nth-child(${columnIndex})`)
    .text()
    .trim()

const link = ($row, columnIndex) =>
  $row
    .find(`td:nth-child(${columnIndex})`)
    .find('a')
    .attr('href')

/**
 * Extract the relevant information from the dom node and return
 * an object with the data mapped by the appropriate named key
 * @param {HTMLNode} $row - The dom node that contains the tabular data
 * @param {String} effectiveStartDate - The start date the terminal procedure is effective for 
 * @param {HTMLNode} effectiveEndDate - The end date the terminal procedure is effective for
 */
const extractRow = ($row, effectiveStartDate, effectiveEndDate) => {
  const type = text($row, 7)

  if (!type) {
    return null
  }

  const flag = text($row, 6)
  let flagExplicit = 'Unchanged'
  switch (flag) {
    case '':
      flagExplicit = 'Unchanged'
      break
    case 'A':
      flagExplicit = 'Added'
      break
    case 'C':
      flagExplicit = 'Changed'
      break
    case 'D':
      flagExplicit = 'Deleted'
      break
    default:
      flagExplicit = 'Unknown edit state'
  }

  return {
    state: text($row, 1),
    city: text($row, 2),
    airport: text($row, 3),
    ident: text($row, 4),
    vol: text($row, 5),
    flag,
    flagExplicit,
    type,
    procedure: {
      name: text($row, 8),
      url: link($row, 8)
    },
    compare: {
      name: text($row, 9),
      url: link($row, 9)
    },
    effectiveStartDate,
    effectiveEndDate
  }
}

/**
 * Scrape the Effective date range from the dom
 * @param {Object} $ - The Cheerio object that contains the serialized dom
 * @returns {Object} - An object containing the effective start and end date
 */
const extractEffectiveDates = $ => {
  const baseEffectiveDateString = $('.resultsSummary .join').html()
  .split(':')[1]
  .split('<')[0]
  .trim()

  return parseEffectiveDates(baseEffectiveDateString)
}

const parseEffectiveDates = str => {
  if (!str) {
    return null
  }
  const [ startMonthDay, remainder ] = str.split('-')
  const [ endMonthDay, yearAndCycle ] = remainder.split(',')
  const [ year, _ ] = yearAndCycle.split('[')

  const effectiveStartDate = new Date(`${startMonthDay.trim()} ${year}`)
  effectiveStartDate.setUTCHours(0,0,0,0)

  const effectiveEndDate = new Date(`${endMonthDay.trim()} ${year}`)
  effectiveEndDate.setUTCHours(0,0,0,0)

  return { effectiveStartDate, effectiveEndDate }
}

/**
 * Parse the response HTML into JSON
 * @param {string} html 
 * @returns {Object} - The scraped and transformed data and the number of result pages
 */
const parse = html => {
  const $ = cheerio.load(html)
  const $resultsTable = $('#resultsTable')
  const noResultsFound = $('.message-box.info').text().trim()
  let results = []

  // As part of the response scraping, scrape the pagination node to get the number of <li>
  // nodes that are not the li.arrow nodes for prev next
  let pageCount = 0
  const pager = $('#content .pagination li:not(.arrows) a')
  if (pager.length) {
    pageCount = parseInt(pager[pager.length - 1].attribs.href.split('&page=')[1])
  }

  if (!!noResultsFound && noResultsFound === 'No results found.') {
    console.warn(noResultsFound)
    return { results, pageCount }
  }
  else if (!$resultsTable.html()) {
    console.error('Unable to parse the #resultsTable page element')
    return { results, pageCount }
  }

  const { effectiveStartDate, effectiveEndDate } = extractEffectiveDates($)

  results = $resultsTable
    .find('tr')
    .toArray()
    .map(row => extractRow($(row), effectiveStartDate, effectiveEndDate))
    .filter(x => !!x)

  if (results.length > 0) {
    return { results, pageCount }
  }
  return { results, pageCount }
}

const terminalProcedures = require('./')

// Should log current cycle effective object
terminalProcedures.fetchCycle().then(c => {
  console.log('current cycle effective object, no param')
  console.dir(c)
})

// Should log current cycle effective object
terminalProcedures.fetchCycle('Current').then(c => {
  console.log('current cycle effective object, with param')
  console.dir(c)
})

// Should log next cycle effective object
terminalProcedures.fetchCycle('Next').then(c => {
  console.log('next cycle effective object, with param')
  console.dir(c)
})

// Should log current cycle code
terminalProcedures.fetchCurrentCycleCode().then(c => {
  console.log('current cycle code')
  console.log(c)
})

// Should log the current cycle effective dates
terminalProcedures.getCycleEffectiveDates().then(c => {
  console.log('the current cycle effective dates, no param')
  console.log(c)
})
// Should log the current cycle effective dates
terminalProcedures.getCycleEffectiveDates('Current').then(c => {
  console.log('the current cycle effective dates, with param')
  console.log(c)
})
// Should log the next cycle effective dates
terminalProcedures.getCycleEffectiveDates('Next').then(c => {
  console.log('the next cycle effective dates')
  console.log(c)
})

// Should log the current cycle effective dates
terminalProcedures.currentCycleEffectiveDates().then(c => {
  console.log('the current cycle effective dates')
  console.log(c)
})

// Also try updating the Flag property to include one or more of the following:
//  A for only those that were Added since the last effective date
//  C for only those that were Changed since the last effective date
//  D for only those that were Deleted since the last effective date
//  Leave empty to get all regardless of if they've been added or changed
// The `getNextCycle` option will get the next cycle if it is available when set to true
//  If it is omitted or set to false, the current cycle will be queried
terminalProcedures.list('PANC', { flag: [ ], getNextCycle: true, }).then(results => {
  console.log(results)
  const out = results.map(tp => {
    return {
      name: tp.procedure.name,
      type: tp.type,
      url: tp.procedure.url,
      effectiveStartDate: tp.effectiveStartDate,
      effectiveEndDate: tp.effectiveEndDate,
    }
  })
  console.log(
    JSON.stringify(
      {
        documents: {
          terminalProcedures: [ out ]
        }
      },
      null,
      2
    )
  )
})

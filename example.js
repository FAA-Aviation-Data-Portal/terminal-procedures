const terminalProcedures = require('./')

terminalProcedures.fetchCurrentCycle().then(r => console.log(r))

terminalProcedures.currentCycleEffectiveDates().then(console.log)

// Also try updateing the Flag property to include one or more of the following:
//  A for only those that were Added since the last effective date
//  C for only those that were Changed since the last effective date
//  D for only those that were Deleted since the last effective date
//  Leave empty to get all regardless of if they've been added or changed
terminalProcedures.list('PANC', { flag: [ 'A', 'C' ], }).then(results => {
  console.log(results)
  const out = results.map(tp => {
    return {
      name: tp.procedure.name,
      type: tp.type,
      url: tp.procedure.url
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

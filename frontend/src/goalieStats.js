export const GOALIE_STATS = [
  // ── Core ──────────────────────────────────────────────────────────────
  { label: 'Games Played',             keys: ['games_played', 'gp'],                                                 lowerIsBetter: false },
  { label: 'Games Started',            keys: ['number_of_games_started', 'number of games started'],                 lowerIsBetter: false },
  { label: 'Games Won',                keys: ['number_of_games_won', 'number of games won'],                         lowerIsBetter: false },
  { label: 'Games Lost',               keys: ['number_of_games_lost', 'number of games lost'],                       lowerIsBetter: true  },
  { label: 'Goals Against',            keys: ['goals_against', 'goals against'],                                     lowerIsBetter: true  },
  { label: 'Shots Faced',              keys: ['total_shots_goalkeeper', 'total shots (goalkeeper)'],                 lowerIsBetter: false },
  { label: 'Saves',                    keys: ['23'],                                                                 lowerIsBetter: false },
  { label: 'Save %',                   keys: ['saves', '% saves'],                                                   lowerIsBetter: false },
  { label: 'Accurate Pass %',          keys: ['accurate_passes'],                                                    lowerIsBetter: false },
  // ── xG (tpl=226) ──────────────────────────────────────────────────────
  { label: 'xG Conceded',              keys: ['250'],                                                                lowerIsBetter: true  },
  { label: 'xG/Shot Taken',            keys: ['251'],                                                                lowerIsBetter: false },
  { label: 'xG/Goal Conceded',         keys: ['252'],                                                                lowerIsBetter: false },
  { label: 'xG/Shot Saved',            keys: ['253'],                                                                lowerIsBetter: false },
  // ── Scoring chances (tpl=226) ─────────────────────────────────────────
  { label: 'Scoring Chances Against',  keys: ['231'],                                                                lowerIsBetter: true  },
  { label: 'Scoring Chances Saved',    keys: ['232'],                                                                lowerIsBetter: false },
  { label: 'Scoring Chances Saved %',  keys: ['233'],                                                                lowerIsBetter: false },
  { label: 'Breakaway Save %',         keys: ['237'],                                                                lowerIsBetter: false },
  // ── Shot types faced % of total (tpl=226) ────────────────────────────
  { label: 'Shots - With Traffic %',   keys: ['156_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Shots - Clear View %',     keys: ['157_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Shots - With Deke %',      keys: ['158_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Shots <2m %',             keys: ['164_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Shots 2-4m %',            keys: ['165_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Shots 4-10m %',           keys: ['166_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Shots 10+m %',            keys: ['167_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Uncontrolled Rebounds %',  keys: ['172_pct'], format: 'pct',                                            lowerIsBetter: true  },
  { label: 'Controlled Rebounds %',    keys: ['173_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Shots Frozen %',          keys: ['175_pct'], format: 'pct',                                            lowerIsBetter: false },
  { label: 'Goals Against Avg Dist',   keys: ['176'],                                                                lowerIsBetter: false },
];

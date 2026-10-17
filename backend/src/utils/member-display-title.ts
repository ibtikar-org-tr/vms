export type MemberTitleSource = 'position' | 'project_role' | 'platform_role'

export type MemberProjectAffiliation = {
  projectName: string
  parentProjectId: string | null
  role: string
}

export type MemberPositionAffiliation = {
  positionName: string
  projectName: string
  parentProjectId: string | null
}

export type MemberDisplayTitle = {
  title: string
  source: MemberTitleSource
}

type TitleCandidate = MemberDisplayTitle & {
  rank: number
}

function isBoardProject(projectName: string) {
  return /مجلس\s*الإدارة|board of directors/i.test(projectName)
}

function chairBoost(title: string) {
  const normalized = title.trim().toLowerCase()
  const isChair = /رئيس|chair|president/.test(normalized)
  const isVice = /نائب|vice|deputy/.test(normalized)

  if (isChair && !isVice) {
    return 2
  }

  if (isChair) {
    return 1
  }

  return 0
}

function isGenericBoardMemberTitle(title: string) {
  const normalized = title.trim()
  return /^(عضو\s*مجلس(\s*ال)?إدارة|board\s*member)$/i.test(normalized)
}

function projectRoleTitle(role: string, isBoard: boolean) {
  if (isBoard) {
    if (role === 'owner' || role === 'manager') return 'رئيس مجلس الإدارة'
    if (role === 'observer') return 'مراقب مجلس الإدارة'
    return 'عضو مجلس الإدارة'
  }

  if (role === 'owner') return 'مالك مشروع'
  if (role === 'manager') return 'مدير مشروع'
  if (role === 'observer') return 'مراقب'
  return 'متطوع'
}

function projectRoleRank(role: string, isBoard: boolean) {
  if (isBoard && (role === 'owner' || role === 'manager')) {
    return role === 'owner' ? 120 : 115
  }

  const roleScore = role === 'owner' ? 4 : role === 'manager' ? 3 : role === 'member' ? 2 : 1
  return (isBoard ? 50 : 20) + roleScore
}

function positionRank(positionName: string, isBoard: boolean) {
  if (isGenericBoardMemberTitle(positionName)) {
    return isBoard ? 52 : 30
  }

  const boost = chairBoost(positionName)
  if (isBoard) {
    return 90 + boost * 5
  }

  return 36 + boost * 6
}

function platformRoleTitle(userRole: string) {
  return userRole.trim().toLowerCase() === 'admin' ? 'مدير المنصة' : 'عضو'
}

export function resolveMemberDisplayTitle(
  affiliations: MemberProjectAffiliation[],
  positions: MemberPositionAffiliation[],
  userRole: string,
): MemberDisplayTitle {
  const candidates: TitleCandidate[] = [
    {
      title: platformRoleTitle(userRole),
      source: 'platform_role',
      rank: 0,
    },
  ]

  for (const affiliation of affiliations) {
    const isBoard = isBoardProject(affiliation.projectName)
    candidates.push({
      title: projectRoleTitle(affiliation.role, isBoard),
      source: 'project_role',
      rank: projectRoleRank(affiliation.role, isBoard),
    })
  }

  for (const position of positions) {
    const name = position.positionName.trim()
    if (!name) {
      continue
    }

    const isBoard = isBoardProject(position.projectName)
    candidates.push({
      title: name,
      source: 'position',
      rank: positionRank(name, isBoard),
    })
  }

  candidates.sort((left, right) => {
    if (left.rank !== right.rank) {
      return right.rank - left.rank
    }

    if (left.source !== right.source) {
      if (left.source === 'position') return -1
      if (right.source === 'position') return 1
    }

    return right.title.length - left.title.length
  })

  const winner = candidates[0]
  return { title: winner.title, source: winner.source }
}

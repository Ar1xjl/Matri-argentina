import { COLOR, pMuted, grid2 } from './styles'
import { Card, Callout, Pill, RoleTag, Table, Flow, FlowStep, FlowArrow, Link, OrgTree, LinkCard, PageHeader } from './ui'

// English content for "About the Portal". Mirrors es.jsx section by section — keep them in sync.
export const SECTIONS_EN = {

  arquitectura: ({ onNavigate }) => (
    <>
      <PageHeader eyebrow="Overview" title="Portal architecture"
        intro="A quick look at the three pieces that hold everything else together: the Organization hierarchy, the User profiles inside each one, and the process flows that connect them. The following pages go into the detail of each piece — this is the big picture." />

      <Card title="🌳 Organizations, as a tree">
        <p style={pMuted}>Everything in the portal — users, prices, cold rooms, treatments — hangs from an Organization, and each Organization has a fixed place in a four-level tree:</p>
        <OrgTree labels={['🌐 FreshInset Global', '📦 Distributor — e.g. Wassington (Argentina)', '🏬 Sub-distributor — e.g. Podlesh (Río Negro)', '🧊 Customer — e.g. Kleppe S.A.']} />
        <p style={pMuted}>The visibility rule is the same at all four levels: <strong>each Organization sees its own level and everything hanging below it</strong> — never what is beside or above it. A Sub-distributor sees its own Customers, but not those of another Sub-distributor or of its sibling Distributor. How a new Organization enters this tree is covered in <Link to="altas" onNavigate={onNavigate}>Onboarding organizations and users</Link>.</p>
      </Card>

      <Card title="👤 The users of each Organization">
        <p style={pMuted}>Within their Organization, each person has one or more <strong>Business Roles</strong> — they are independent of each other, not a ladder:</p>
        <Table headers={['Role', 'What they can do']} rows={[
          [<RoleTag>Owner</RoleTag>, 'Full access to their organization and everything below it. The only role that manages users.'],
          [<RoleTag>Approver</RoleTag>, 'Reviews, sets the final price and approves or rejects Treatments from the organizations below.'],
          [<RoleTag>Planner</RoleTag>, 'Creates, edits and submits Treatments — uses the Calculator and loads the Season Plan.'],
          [<RoleTag>Operator</RoleTag>, 'Records the physical application of the treatment and uploads the MatriSure verification.'],
          [<RoleTag>Viewer</RoleTag>, 'Read-only access to Treatments and history.'],
        ]} />
        <p style={{ ...pMuted, marginTop: '10px' }}>What a Role can do <em>beyond</em> that varies by the type of Organization it belongs to — Global, Distributor and Sub-distributor have different nuances for Inventory, Catalog and Pricing. The full detail, combination by combination, is in <Link to="roles" onNavigate={onNavigate}>Roles and permissions</Link>.</p>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '22px 0 4px' }}>🔄 The flows that bring the Portal to life</div>
      <p style={{ ...pMuted, marginBottom: '12px' }}>The Organization decides <strong>what you see</strong>; the Role decides <strong>what you can do</strong> with what you see. Everything you actually do in the portal day to day goes through these flows:</p>

      <div style={{ fontSize: '11px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Critical flows</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <LinkCard icon="🏢" title="Onboarding organizations and users" desc="How a new Organization or person comes in." to="altas" onNavigate={onNavigate} />
        <LinkCard icon="🗓️" title="Campaign planning" desc="Sketch the season before committing." to="plan" onNavigate={onNavigate} />
        <LinkCard icon="🧮" title="Calculator, DoseRight and KB" desc="Decide and calculate a dose." to="calculadora" onNavigate={onNavigate} />
        <LinkCard icon="📦" title="Treatment lifecycle" desc="From Submitted to Completed." to="tratamientos" onNavigate={onNavigate} />
        <LinkCard icon="💲" title="Pricing" desc="Distributor price lists and negotiated prices." to="precios" onNavigate={onNavigate} />
      </div>

      <div style={{ fontSize: '11px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Operations and quality</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <LinkCard icon="📸" title="MatriSure" desc="Visual verification that the dose was reached." to="matrisure" onNavigate={onNavigate} />
        <LinkCard icon="📊" title="Firmness Evaluation" desc="Effect of the treatment on the fruit." to="firmeza" onNavigate={onNavigate} />
        <LinkCard icon="⚡" title="Generators" desc="Lifecycle of each physical unit." to="generadores" onNavigate={onNavigate} />
        <LinkCard icon="🏷️" title="Inventory and Catalog" desc="The Distributor's stock and SKU sizes." to="inventario" onNavigate={onNavigate} />
      </div>

      <div style={{ fontSize: '11px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Support and reference</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <LinkCard icon="📄" title="Documents" desc="The Organization's documentation." to="documentos" onNavigate={onNavigate} />
        <LinkCard icon="🔔" title="Notifications" desc="What the bell alerts you about today." to="notificaciones" onNavigate={onNavigate} />
        <LinkCard icon="🔐" title="Roles and permissions" desc="The full matrix, screen by screen." to="roles" onNavigate={onNavigate} />
        <LinkCard icon="📚" title="Glossary" desc="The business terms, in one line each." to="glosario" onNavigate={onNavigate} />
      </div>
    </>
  ),

  altas: () => (
    <>
      <PageHeader eyebrow="Critical flow · Organization" title="Onboarding organizations and users"
        intro='Two different onboardings live here: bringing a new organization into the tree (Distributor, Sub-distributor or Customer), and bringing a person into an organization that already exists.' />

      <div style={{ fontWeight: 800, color: COLOR.navy, marginBottom: '10px' }}>1. Onboarding an organization</div>
      <div style={grid2}>
        <Card title="📋 Manual path — “+ New organization”">
          <p style={pMuted}>From <strong>Organizations</strong> (Distributor Panel → CRM), any Owner/Approver of a non-Customer organization can create the one that comes next below it in their own tree:</p>
          <ul style={{ ...pMuted, margin: '8px 0', paddingLeft: '20px' }}>
            <li>Global can only create <strong>Distributors</strong>.</li>
            <li>A Distributor can create <strong>Sub-distributors</strong> or <strong>Customers</strong>.</li>
            <li>A Sub-distributor can only create <strong>Customers</strong>.</li>
          </ul>
          <p style={pMuted}>Fields: Name, Type, Parent organization, Country and — only for a Distributor — Currency and USD exchange rate.</p>
        </Card>
        <Card title="🙋 Self-service path — “Request access”">
          <p style={pMuted}>A prospective Customer without an account yet fills in the public form <strong>“Request access — new company”</strong>: Company name, tax ID, tax status, province, email and phone.</p>
          <p style={pMuted}>The request lands in <strong>“📥 Pending access requests”</strong>, visible to any Distributor, Sub-distributor or Global staff. From there it can be <Pill kind="info">Assigned to an organization</Pill> or <Pill kind="bad">Rejected</Pill>.</p>
        </Card>
      </div>

      <Flow>
        <FlowStep n={1} state="Commercial agreement" who="Outside the portal">Negotiated between FreshInset and the new partner before touching the system.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="⏳ Pending" who="Whoever creates it">The organization is created but cannot operate yet.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="✓ Active" who="FreshInset Global">“Activate” button, visible only to Global. The only gate — no additional checklist.</FlowStep>
        <FlowArrow />
        <FlowStep n={4} state="Up and running" who="The new Owner">Sets up their own price tables and can now receive Users, Cold rooms and Treatments.</FlowStep>
      </Flow>

      <Callout label="Why it always goes through Global">
        Even when a Distributor creates its own Sub-distributor — something the system technically lets it do without asking anyone — that organization is still born “Pending” and needs FreshInset Global’s approval before operating. It is a business decision, not a technical limitation.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '26px 0 10px' }}>2. Onboarding a user within an active organization</div>
      <div style={grid2}>
        <Card title="🔗 Invite by link (most direct)">
          <p style={pMuted}>An Owner picks the organization and Business Roles in advance under <strong>Users → “🔗 Invite by link”</strong> and shares the link manually. Whoever opens it is assigned automatically, without the Owner needing to know their email beforehand.</p>
        </Card>
        <Card title="📥 Self-registration + manual assignment">
          <p style={pMuted}>The person creates their login with <strong>“Create user”</strong> (login only, no organization yet). They appear under <strong>“📥 User requests pending assignment”</strong> — any Owner can <Pill kind="info">Assign</Pill> or <Pill kind="neutral">Dismiss</Pill>.</p>
        </Card>
      </div>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Business Roles</div>
      <p style={{ ...pMuted, marginBottom: '6px' }}>They are independent of each other — not a ladder. A person can hold several at once.</p>
      <Table headers={['Role', 'What they can do']} rows={[
        [<RoleTag>Owner</RoleTag>, 'Full access to their organization and everything below it. The only role that manages users. Every organization needs at least one Owner at all times.'],
        [<RoleTag>Approver</RoleTag>, 'Reviews, sets the final price and approves or rejects Treatments submitted by the organizations below.'],
        [<RoleTag>Planner</RoleTag>, 'Creates, edits and submits Treatments — uses the Calculator and loads the Season Plan.'],
        [<RoleTag>Operator</RoleTag>, 'Records the physical application of the treatment and uploads the MatriSure verification.'],
        [<RoleTag>Viewer</RoleTag>, 'Read-only access to Treatments and history — cannot create or modify anything.'],
      ]} />

      <Callout label="Owner succession">
        In a Sub-distributor or Customer, replacing the Owner is fully autonomous. In a Distributor, it needs FreshInset Global’s approval — the same gate as its original onboarding.
      </Callout>
    </>
  ),

  plan: () => (
    <>
      <PageHeader eyebrow="Critical flow · Planning" title="Campaign planning"
        intro="The Season Plan is a non-binding table for sketching the whole campaign — every cold room, every date — before committing to a real Treatment. It coexists with the Calculator without replacing it." />

      <Card title="What each plan line contains">
        <Table headers={['Field', 'Detail']} rows={[
          ['Cold room', 'One of the Customer’s own cold rooms.'],
          ['Crop', 'Filled in or updated together with the cold room.'],
          ['Estimated date', 'When that cold room is planned to be treated.'],
          ['Dose (ppb)', 'Optional at this stage.'],
          ['Product', 'Powder / Tablets / Undecided.'],
          ['Indicative cost', 'Recalculated live against the current price — never a commitment.'],
          ['Status', <>{<Pill kind="warn">Planned</Pill>} or {<Pill kind="ok">Converted</Pill>}</>],
        ]} />
      </Card>

      <div style={grid2}>
        <Card title="Row-by-row entry">
          <p style={pMuted}>A table editable right on screen, plus a multi-selector with <strong>“Apply to selected”</strong> to assign a Product in bulk.</p>
        </Card>
        <Card title="Bulk upload via Excel">
          <p style={pMuted}>Downloadable template (Cold store, Cold room, Volume, Dose, Date, Crop). Detects duplicates by Cold room + Date and asks whether to add or replace.</p>
        </Card>
      </div>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>From planned line to real Treatment</div>
      <Flow>
        <FlowStep n={1} state="Select rows" who="Customer">You pick one or several lines in “Planned” status.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="“Convert to Treatment”" who="Customer">Each line goes, one by one, through the real Calculator.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="Confirm" who="Customer">It is reviewed/adjusted and confirmed. It enters directly as a Submitted Treatment.</FlowStep>
      </Flow>

      <Callout kind="real" label="🔧 Actual status">
        There is no separate Draft step in the conversion — going through the Calculator when converting <em>is</em> the review step, by design. Converting a line does not reserve stock or trigger any approval by itself.
      </Callout>

      <div style={{ ...grid2, marginTop: '18px' }}>
        <Card title="🤝 Draft prepared by the Distributor">
          <p style={pMuted}>A Distributor or Sub-distributor can prepare an estimated Season Plan for a Customer that has not loaded its own yet. It stays invisible until “Share” is pressed, which copies the lines into the Customer’s real plan.</p>
        </Card>
        <Card title="📊 Consolidated view (rollup)">
          <p style={pMuted}>The Distributor sees, read-only, the plan of all its Customers at once — useful for assigning generators before it becomes a Treatment.</p>
        </Card>
      </div>
    </>
  ),

  calculadora: ({ onNavigate }) => (
    <>
      <PageHeader eyebrow="Critical flow · Dose decision" title="Calculator, DoseRight and Knowledge Base"
        intro='The three tools for deciding and calculating a dose before creating a Treatment.' />

      <Card title="🧮 Dose calculator">
        <p style={pMuted}>Choose your <strong>Cold room</strong> and, if you like, give it a <strong>Custom name</strong> to identify it better. In <strong>Target dose (ppb)</strong> enter the dose you want to apply in that cold room — if you are not sure which one to use, the <strong>“Standard (1,000 ppb)”</strong> shortcut loads the usual reference value (1,000 ppb = 0.067 g of MatriPowder 3.3% per m³), or you can consult DoseRight (see below) to get a dose suggestion based on your fruit and your cold room.</p>
        <p style={pMuted}>A bar at the top shows whether the calculation is using your <strong>negotiated price</strong> with your Distributor or the <strong>standard list</strong>. When you press “Calculate and compare alternatives” you will always see the 3 options side by side (Powder Round-Up, Powder Round-Down, Tablets) with real prices, so you can compare before deciding. Choosing one and confirming creates the Treatment — see <Link to="tratamientos" onNavigate={onNavigate}>Treatment lifecycle</Link>.</p>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>🔬 What is DoseRight?</div>
      <p style={{ ...pMuted, marginBottom: '10px' }}>DoseRight is a scientific reference tool: it reviews the published literature on 1-MCP (harvest maturity, storage conditions, time since harvest) and, from that, suggests a dose for your specific case. It does not decide for you — it is an assistant for making a more informed decision. <strong>The final decision on which dose to apply is always yours.</strong> It opens from the “Not sure which dose to use?” callout inside the Calculator itself.</p>
      <Flow>
        <FlowStep n={1} state="Open DoseRight" who="Pop-up window">Opens in a separate window, not embedded — needed so the suggested dose can be sent back to the Calculator.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="Adjust parameters" who="You">You enter harvest maturity, storage conditions and hours since harvest — the real data of your fruit.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state='"Use this dose"' who="You">The suggested dose pre-fills the Calculator’s ppb field — you can still adjust it before confirming.</FlowStep>
      </Flow>

      <Callout label="DoseRight suggests, it does not prescribe">
        DoseRight assists you by reviewing the available scientific evidence — but the final responsibility for choosing the dose is always yours, not the tool’s. The Treatment internally records where the dose came from (<code>manual</code> or <code>doseright</code>) for traceability, although it is not currently shown as a visible label on screen.
      </Callout>

      <Card title="📚 MaTri Knowledge Base" style={{ marginTop: '18px' }}>
        <p style={pMuted}>A collection of published scientific papers on the effect of different physiological parameters (maturity, firmness, storage atmosphere, temperature, time since harvest, etc.) on the use of 1-MCP — the same evidence DoseRight relies on for its suggestions. It is a fixed item in the side menu (“📚 MaTri Knowledge Base”) that opens that material in a new tab, available to any portal user.</p>
      </Card>
    </>
  ),

  tratamientos: ({ onNavigate, isCustomer }) => (
    <>
      <PageHeader eyebrow="Critical flow · Operations" title="Treatment lifecycle"
        intro="The Treatment is the central entity of the business: it stores dose, frozen price, history and scientific evidence from start to finish." />

      <Flow>
        <FlowStep n={1} state="Submitted" who="👤 Planner">Created from the Calculator or by converting a Season Plan line.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="Approved" who="✅ Approver">Confirms or adjusts the final price — frozen forever.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="Applied" who="🔧 Operator">Records the actual start and end date/time.</FlowStep>
        <FlowArrow />
        <FlowStep n={4} state="Completed" who="📸 Customer / Approver">MatriSure uploads the photo and confirms the result. Closed and immutable.</FlowStep>
      </Flow>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', fontSize: '12.5px', color: COLOR.muted, flexWrap: 'wrap' }}>
        <span>It can also end as:</span>
        <Pill kind="bad">✗ Rejected</Pill> <span>— the Approver rejects with a mandatory reason.</span>
      </div>

      <Callout kind="real" label="🔧 Actual status">
        There is no editable <strong>Draft</strong> status today: a Treatment is born directly as “Submitted”. There is also no button to edit and resubmit a Rejected Treatment. “Cancelled” exists in the data model, but there is currently no button in the interface to reach it.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '24px 0 10px' }}>Step by step</div>
      <ol style={{ ...pMuted, paddingLeft: '20px' }}>
        <li style={{ marginBottom: '10px' }}><strong>Creation (Planner).</strong> Cold room + dose, always with the 3 alternatives visible. On confirming it enters the Approver’s queue.</li>
        <li style={{ marginBottom: '10px' }}><strong>Approval (Approver/Owner, Distributor Panel).</strong> <Pill kind="ok">✓ Approve</Pill> sets the final price. <Pill kind="bad">✗ Reject</Pill> asks for a reason visible to the Customer.</li>
        <li style={{ marginBottom: '10px' }}><strong>Physical application (Operator).</strong> Enters the full start and end date/time.</li>
        <li style={{ marginBottom: '10px' }}><strong>MatriSure verification.</strong> Live photo, self-confirmation or “ask for help” — see <Link to="matrisure" onNavigate={onNavigate}>MatriSure</Link>.</li>
        <li><strong>Completed.</strong> Price and sachet breakdown are frozen forever.</li>
      </ol>

      <Callout label="Who sees the approval queue">
        Only Owners and Approvers (on your Distributor’s side) see “Treatments pending approval”.{!isCustomer && <> More detail in <Link to="roles" onNavigate={onNavigate}>Roles and permissions</Link>.</>}
      </Callout>
    </>
  ),

  precios: () => (
    <>
      <PageHeader eyebrow="Critical flow · Commercial" title="Pricing"
        intro="Each Distributor builds its own price list from scratch, in its own currency — it is never inherited from FreshInset Global." />

      <Card title='The 4 tables — Distributor Panel → "💲 Price management"'>
        <Table headers={['Table', 'Unit', 'Segmented by']} rows={[
          ['Product', '$/m³', 'SKU (Powder / Tablets) × volume bracket'],
          ['Application service', '$/treatment', 'Bracket — only Powder with managed service'],
          ['Generator', 'purchase $/unit', 'Bracket'],
          ['Volume brackets', '—', 'Editable per Distributor (0–600 / 600–1,200 / 1,200–1,800 / 1,800+ m³ by default)'],
        ]} />
        <p style={{ ...pMuted, marginTop: '10px' }}>Only Owners and Approvers edit these tables. Global sees them read-only; a Sub-distributor has full control over its own.</p>
      </Card>

      <Callout label="Who sets the price for whom">
        When a Customer hangs from a Sub-distributor that built its own price, that price wins. If it has not configured its own brackets, the one from the nearest ancestor that has is used.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Negotiated price per Customer</div>
      <p style={{ ...pMuted, marginBottom: '10px' }}><strong>“💲 Price”</strong> button in Organizations, visible only to the Owner/Approver of the immediate parent organization.</p>
      <Table headers={['Order', 'Mechanism', 'Typical use']} rows={[
        ['1', 'Agreed fixed price ($/m³)', 'Large accounts — replaces the whole bracket table.'],
        ['2', '% discount on list', 'Mid-size accounts.'],
        ['3', 'List price, unchanged', 'Small accounts or those with higher collection risk.'],
      ]} />
      <p style={pMuted}>An agreement can carry a <strong>committed minimum volume</strong> — purely informational, it never blocks the price on its own.</p>

      <Callout kind="real" label="📌 The freeze (snapshot)">
        When a Treatment is approved, the final price and the sachet breakdown are photographed forever — together with their USD equivalent. Future changes to price, catalog or exchange rate never alter already-approved Treatments.
      </Callout>
    </>
  ),

  matrisure: () => (
    <>
      <PageHeader eyebrow="Operations and quality" title="MatriSure — dose verification"
        intro="The MaTriSure Kit is your visual confirmation that the 1-MCP treatment reached the correct concentration inside the cold room — a “silent witness” that only responds when the dose has really been reached." />

      <Card title="🔬 How it works">
        <p style={pMuted}>Inside the Kit there is an indicator strip with a proprietary dye that reacts specifically with 1-MCP gas — no detectable reaction has been observed against other gases present in the cold room, such as ethylene. As 1-MCP builds up in the sealed cold room, the dye changes color until it confirms the dose was reached.</p>
        <ul style={{ ...pMuted, margin: '10px 0 0', paddingLeft: '20px' }}>
          <li>The response is <strong>cumulative</strong> throughout the treatment — it is not an instant reaction.</li>
          <li>A noticeable color change may start <strong>before</strong> reaching the final target dose.</li>
          <li>The indicator changes color <strong>completely</strong> at, or above, the correct concentration.</li>
          <li>The final color confirms the cold room received the intended 1-MCP dose.</li>
        </ul>
      </Card>

      <Card title="⏱️ Timing and best practices">
        <p style={pMuted}>MaTri Tablets or Powder release the 1-MCP into the cold room in about <strong>1 hour</strong>. However, an effective fruit treatment needs a full exposure period of <strong>24 hours</strong>, with the cold room sealed the whole time.</p>
        <p style={pMuted}>After 24 hours, remove the kit and check the final color: if it changed color at the end of the treatment, the correct dose was reached and your fruit received the intended protection.</p>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>How the verification is uploaded in the portal</div>
      <Card>
        <p style={pMuted}>The photo is taken live from the device camera — there is no button to upload from the gallery. This is intentional: it prevents uploading an old photo to tamper with the verification.</p>
      </Card>

      <div style={grid2}>
        <Card title="✓ Self-confirmation (the most common case)">
          <p style={pMuted}>You upload the photo yourself and mark <Pill kind="ok">✓ Dose reached</Pill> or <Pill kind="bad">✗ Not reached</Pill> according to the color you see.</p>
        </Card>
        <Card title="🙋 Ask for help (if you are not sure)">
          <p style={pMuted}>If you are not sure how to read the strip, tick “ask for help” when uploading the photo — your Distributor confirms the result for you.</p>
        </Card>
      </div>

      <Callout label="“Not reached” does not block closing">
        A “Not reached” result still takes the Treatment to Completed — it is recorded as an alert, but it never prevents closing it.
      </Callout>

      <Callout kind="real" label="🔧 Actual status / future">
        Automatic classification of the strip color is a future roadmap item — today the reading is done by you (or your Distributor, if you asked for help). The full illustrated Kit guide is not yet loaded in Documents — in the meantime, any question about the procedure can be raised directly with your Distributor.
      </Callout>
    </>
  ),

  firmeza: ({ isCustomer }) => (
    <>
      <PageHeader eyebrow="Operations and quality" title="Firmness Evaluation"
        intro="Different from MatriSure: MatriSure confirms the concentration inside the cold room; the Firmness Evaluation confirms the effect on the fruit (Control vs. Matri)." />

      {isCustomer ? (
        <Card title="🍐 An optional additional service">
          <p style={pMuted}>The Firmness Evaluation is an additional service you can contract with your Distributor — it is not an automatic part of the Treatment. If you contract it, here you will see the follow-up report of the samples (untreated Control vs. treated Matri) over the post-harvest days, including the firmness-loss chart and, if available, the signed PDF.</p>
        </Card>
      ) : (
        <>
          <Card title="Who can enter it">
            <p style={pMuted}>Only non-Customer staff in the Treatment’s ancestor chain, with the Owner, Approver or Operator role. The Customer and the rest of the chain can only view and download the signed PDF.</p>
          </Card>

          <div style={grid2}>
            <Card title="Where it is entered">
              <p style={pMuted}>Distributor Panel → Treatments tab → “📊 + Evaluation” button, on an Applied or Completed Treatment.</p>
            </Card>
            <Card title="What it calculates by itself">
              <p style={pMuted}>The firmness-loss rate and its chart are derived automatically from the samples entered.</p>
            </Card>
          </div>
        </>
      )}
    </>
  ),

  generadores: () => (
    <>
      <PageHeader eyebrow="Operations and quality" title="Generators"
        intro="Only relevant for MatriPowder — MatriTablets never needs a generator." />

      <Card title="Lifecycle of a unit">
        <Flow>
          <FlowStep state="Available">Just registered.</FlowStep>
          <FlowArrow />
          <FlowStep state="Dispatched">Mandatory pre-dispatch checklist before leaving (sale to Customer).</FlowStep>
          <FlowArrow />
          <FlowStep state="In service → Repaired">Or directly Out of service.</FlowStep>
        </Flow>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Actions from “My generators”</div>
      <Table headers={['Action', 'Who', 'What happens']} rows={[
        ['Register a new unit', 'Global or Distributor only', 'A Sub-distributor never originates new stock.'],
        ['Transfer to sub-distributor', 'Distributor', 'A simple change of owner, no checklist.'],
        ['Sell to customer', 'Distributor/Sub-distributor', 'Mandatory pre-dispatch checklist. Ownership passes to the Customer.'],
        ['Mark as returned', 'Distributor/Sub-distributor', 'Closes a rental that existed before the option was discontinued. New rentals can no longer be started.'],
      ]} />

      <Callout label="Pre-dispatch checklist (blocking)">
        Battery charged, seals intact, start-up test, service up to date. The unit cannot move to “Dispatched” with the checklist incomplete.
      </Callout>

      <Callout kind="real" label="🔧 Actual status — rental discontinued">
        It generated too much support and maintenance load — today only Purchase or Managed service remain as alternatives to owning your own.
      </Callout>

      <Card title="Buy vs. Managed service calculator" style={{ marginTop: '18px' }}>
        <p style={pMuted}>Customer view — it can be fed with real Season Plan data. A Distributor or Global directly sees the status of its own fleet.</p>
      </Card>

      <Callout kind="real" label="📄 User guide — in preparation">
        There is no generator user guide loaded in the portal yet. As soon as it is ready, you will be able to open it directly from here.
      </Callout>
    </>
  ),

  inventario: () => (
    <>
      <PageHeader eyebrow="Operations and quality" title="Inventory and SKU Catalog"
        intro="An internal Distributor tool — today it has no breakdown per Sub-distributor and is not visible to Customers." />

      <div style={grid2}>
        <Card title="🏷️ SKU Catalog">
          <p style={pMuted}><strong>MatriPowder:</strong> editable sachet sizes (default 100g/50g/20g/10g).</p>
          <p style={pMuted}><strong>MatriTablets:</strong> editable envelope sizes, not divisible (default 10/15/50).</p>
        </Card>
        <Card title="📦 Inventory">
          <p style={pMuted}>MatriTablets are tracked in two pools: sealed <strong>envelopes</strong> and <strong>loose</strong> tablets. Opening an envelope is always manual.</p>
        </Card>
      </div>

      <Callout label="Automatic deduction">
        When moving to “Applied”: Powder subtracts from the sachet breakdown; Tablets subtract only from the loose pool. Stock can go negative — a visible signal, it is not hidden.
      </Callout>

      <p style={pMuted}>Manual adjustment remains available for receiving new stock, opening an envelope, or correcting a physical count.</p>
    </>
  ),

  documentos: () => (
    <>
      <PageHeader eyebrow="Support" title="Documents" intro="" />
      <Callout kind="real" label="🔧 Actual status">
        Today “Documents” is a library with content fixed in the code — there is no real upload or versioning from the interface yet. It is pending for production.
      </Callout>
      <Card title="Planned design for when it gets built">
        <p style={pMuted}><strong>Global documentation</strong> (from FreshInset): scientific knowledge base, DoseRight calibration evidence.</p>
        <p style={pMuted}><strong>Organization documentation:</strong> product sheets, safety data sheets, generator manuals, MatriSure guide, regulatory registrations (always at country level).</p>
        <p style={pMuted}>Uploading a new version would be self-service by the Owner, without external review.</p>
      </Card>
    </>
  ),

  notificaciones: () => (
    <>
      <PageHeader eyebrow="Support" title="Notifications" intro="Bell 🔔 in the header — unread counter, refreshed every 30 seconds." />
      <Card title="Events that notify today">
        <ul style={{ ...pMuted, margin: 0, paddingLeft: '20px' }}>
          <li>Treatment submitted → notifies the Approver/Owner of the immediate parent.</li>
          <li>Treatment approved or rejected → notifies whoever created it.</li>
          <li>New company access request.</li>
          <li>New user registration pending assignment.</li>
          <li>MatriSure — the Customer asked for help.</li>
          <li>Invite link redeemed.</li>
        </ul>
      </Card>
      <Callout kind="real" label="🔧 Actual status">
        Only the in-app channel exists — there is no email delivery yet (a dedicated SMTP provider is missing). Time-based alerts are documented but not built yet.
      </Callout>
    </>
  ),

  roles: () => (
    <>
      <PageHeader eyebrow="Reference" title="Roles and permissions" intro="What each Business Role sees and can do inside the Distributor Panel — enforced at the database level, not just hidden on screen." />

      <Callout label="🔎 Full detail">
        For the screen-by-screen detail of each Organization type × Business Role combination, see the{' '}
        <a href="https://claude.ai/code/artifact/dcfbfb24-5589-4101-bfa7-00a002dd71a0" target="_blank" rel="noopener noreferrer" style={{ color: COLOR.infoInk, fontWeight: 700 }}>Roles and Permissions Matrix</a>.
      </Callout>

      <Table headers={['Role', 'CRM/Inventory/Catalog/Pricing', 'Approve/Reject', 'Treatments', 'Firmness Evaluation']} rows={[
        [<RoleTag>Owner</RoleTag>, <Pill kind="ok">Full control</Pill>, <Pill kind="ok">Yes</Pill>, 'Sees everything', 'Yes'],
        [<RoleTag>Approver</RoleTag>, <Pill kind="ok">Full control</Pill>, <Pill kind="ok">Yes</Pill>, 'Sees everything', 'Yes'],
        [<RoleTag>Planner</RoleTag>, <Pill kind="neutral">No access</Pill>, <Pill kind="bad">No</Pill>, 'Only this tab', 'No'],
        [<RoleTag>Operator</RoleTag>, <Pill kind="neutral">No access</Pill>, <Pill kind="bad">No</Pill>, 'No price column', 'Yes'],
        [<RoleTag>Viewer</RoleTag>, <Pill kind="neutral">No access</Pill>, <Pill kind="bad">No</Pill>, 'Read-only', 'No'],
      ]} />

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Nuances by organization type</div>
      <Table headers={['Type', 'Inventory', 'SKU Catalog', 'Pricing']} rows={[
        ['🌐 Global', <Pill kind="warn">Read-only</Pill>, <Pill kind="ok">Full control</Pill>, <Pill kind="warn">Read-only</Pill>],
        ['📦 Distributor', <Pill kind="ok">Full control</Pill>, <Pill kind="ok">Full control</Pill>, <Pill kind="ok">Full control</Pill>],
        ['🏬 Sub-distributor', <Pill kind="ok">Full control (own)</Pill>, <Pill kind="warn">Read-only</Pill>, <Pill kind="ok">Full control (own)</Pill>],
      ]} />

      <Callout label="On the Customer side">
        Today, inside a Customer organization, Approver does not behave any differently from Owner — there is no dedicated screen yet where the difference matters.
      </Callout>
    </>
  ),

  glosario: ({ isCustomer }) => {
    const terms = [
      ['Organization', 'A node of the commercial tree: FreshInset Global, Distributor, Sub-distributor or Customer.'],
      ['Treatment', 'The complete cycle of a MaTri application, from creation to confirmed verification.'],
      ['Season Plan', 'A non-binding table for sketching a campaign before committing to real Treatments.'],
      ['Plan line', 'One row of the Season Plan — cold room + date + dose, convertible into a Treatment.'],
      ['Cold room', 'Physical location where the treatment is applied; full history across seasons.'],
      ['Generator', 'Professional equipment for MatriPowder applications, with its own individual ID.'],
      ['MatriSure', 'Strip kit that confirms with a live photo whether the dose was reached.'],
      ['Firmness Evaluation', 'Control vs. Matri comparison of fruit firmness over the post-harvest days.'],
      ...(isCustomer ? [] : [
        ['Volume bracket', 'm³ range used to segment prices.'],
        ['Negotiated price', 'A specific Customer’s own agreement that replaces the general list.'],
        ['Price snapshot', 'Price and sachet breakdown frozen at the moment a Treatment is approved.'],
        ['FX to USD', 'Each Distributor’s own exchange rate, used to consolidate the FreshInset Global dashboard.'],
      ]),
    ]
    return (
      <>
        <PageHeader eyebrow="Reference" title="Glossary" intro="" />
        <Card>
          {terms.map(([term, def]) => (
            <div key={term} style={{ marginTop: '14px' }}>
              <div style={{ fontWeight: 800, color: COLOR.navy, fontSize: '13.5px' }}>{term}</div>
              <div style={{ fontSize: '13.5px', color: COLOR.muted, lineHeight: 1.55 }}>{def}</div>
            </div>
          ))}
        </Card>
      </>
    )
  },
}

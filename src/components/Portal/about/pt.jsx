import { COLOR, pMuted, grid2 } from './styles'
import { Card, Callout, Pill, RoleTag, Table, Flow, FlowStep, FlowArrow, Link, OrgTree, LinkCard, PageHeader } from './ui'

// Conteúdo em português de "Sobre o Portal". Espelha es.jsx seção por seção — manter os três sincronizados.
export const SECTIONS_PT = {

  arquitectura: ({ onNavigate }) => (
    <>
      <PageHeader eyebrow="Visão geral" title="Arquitetura do Portal"
        intro="Um panorama das três peças que sustentam todo o resto: a hierarquia de Organizações, os perfis de Usuário dentro de cada uma e os fluxos de processo que as conectam. As páginas seguintes detalham cada peça — esta é a visão de conjunto." />

      <Card title="🌳 As Organizações, como uma árvore">
        <p style={pMuted}>Tudo o que existe no portal — usuários, preços, câmaras, tratamentos — pertence a uma Organização, e cada Organização tem um lugar fixo em uma árvore de quatro níveis:</p>
        <OrgTree labels={['🌐 FreshInset Global', '📦 Distribuidor — ex. Wassington (Argentina)', '🏬 Sub-distribuidor — ex. Podlesh (Río Negro)', '🧊 Cliente — ex. Kleppe S.A.']} />
        <p style={pMuted}>A regra de visibilidade é sempre a mesma nos quatro níveis: <strong>cada Organização vê o seu próprio nível e tudo o que está abaixo</strong> — nunca o que está ao lado ou acima. Um Sub-distribuidor vê os seus próprios Clientes, mas não os de outro Sub-distribuidor nem os do seu Distribuidor irmão. Como uma Organização nova entra nesta árvore está em <Link to="altas" onNavigate={onNavigate}>Cadastro de organizações e usuários</Link>.</p>
      </Card>

      <Card title="👤 Os usuários de cada Organização">
        <p style={pMuted}>Dentro da sua Organização, cada pessoa tem um ou vários <strong>Papéis de Negócio</strong> — são independentes entre si, não uma escada:</p>
        <Table headers={['Papel', 'O que pode fazer']} rows={[
          [<RoleTag>Owner</RoleTag>, 'Acesso total à sua organização e a tudo o que está abaixo. Único papel que administra usuários.'],
          [<RoleTag>Aprovador</RoleTag>, 'Revisa, define o preço final e aprova ou rejeita Tratamentos das organizações abaixo.'],
          [<RoleTag>Planejador</RoleTag>, 'Cria, edita e envia Tratamentos — usa a Calculadora e carrega o Plano de Safra.'],
          [<RoleTag>Operador</RoleTag>, 'Registra a aplicação física do tratamento e envia a verificação MatriSure.'],
          [<RoleTag>Viewer</RoleTag>, 'Somente leitura de Tratamentos e histórico.'],
        ]} />
        <p style={{ ...pMuted, marginTop: '10px' }}>O que um Papel pode fazer <em>além disso</em> varia conforme o tipo de Organização em que está — Global, Distribuidor e Sub-distribuidor têm nuances diferentes sobre Estoque, Catálogo e Preços. O detalhe completo, combinação por combinação, está em <Link to="roles" onNavigate={onNavigate}>Papéis e permissões</Link>.</p>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '22px 0 4px' }}>🔄 Os fluxos que dão vida ao Portal</div>
      <p style={{ ...pMuted, marginBottom: '12px' }}>A Organização decide <strong>o que você vê</strong>; o Papel decide <strong>o que você pode fazer</strong> com o que vê. Tudo o que você realmente faz no portal no dia a dia passa por estes fluxos:</p>

      <div style={{ fontSize: '11px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Fluxos críticos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <LinkCard icon="🏢" title="Cadastro de organizações e usuários" desc="Como entra uma Organização ou pessoa nova." to="altas" onNavigate={onNavigate} />
        <LinkCard icon="🗓️" title="Planejamento de safra" desc="Esboçar a temporada antes de se comprometer." to="plan" onNavigate={onNavigate} />
        <LinkCard icon="🧮" title="Calculadora, DoseRight e KB" desc="Decidir e calcular uma dose." to="calculadora" onNavigate={onNavigate} />
        <LinkCard icon="📦" title="Ciclo de um Tratamento" desc="De Enviado a Concluído." to="tratamientos" onNavigate={onNavigate} />
        <LinkCard icon="💲" title="Gestão de preços" desc="Listas por Distribuidor e preços negociados." to="precios" onNavigate={onNavigate} />
      </div>

      <div style={{ fontSize: '11px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Operação e qualidade</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <LinkCard icon="📸" title="MatriSure" desc="Verificação visual de que a dose foi atingida." to="matrisure" onNavigate={onNavigate} />
        <LinkCard icon="📊" title="Avaliação de Firmeza" desc="Efeito do tratamento sobre a fruta." to="firmeza" onNavigate={onNavigate} />
        <LinkCard icon="⚡" title="Geradores" desc="Ciclo de vida de cada unidade física." to="generadores" onNavigate={onNavigate} />
        <LinkCard icon="🏷️" title="Estoque e Catálogo" desc="Estoque e tamanhos de SKU do Distribuidor." to="inventario" onNavigate={onNavigate} />
      </div>

      <div style={{ fontSize: '11px', fontWeight: 700, color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Suporte e referência</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <LinkCard icon="📄" title="Documentos" desc="Documentação da Organização." to="documentos" onNavigate={onNavigate} />
        <LinkCard icon="🔔" title="Notificações" desc="O que o sininho avisa hoje." to="notificaciones" onNavigate={onNavigate} />
        <LinkCard icon="🔐" title="Papéis e permissões" desc="A matriz completa, tela por tela." to="roles" onNavigate={onNavigate} />
        <LinkCard icon="📚" title="Glossário" desc="Os termos do negócio, em uma linha." to="glosario" onNavigate={onNavigate} />
      </div>
    </>
  ),

  altas: () => (
    <>
      <PageHeader eyebrow="Fluxo crítico · Organização" title="Cadastro de organizações e usuários"
        intro='Dois cadastros diferentes convivem aqui: incorporar uma organização nova à árvore (Distribuidor, Sub-distribuidor ou Cliente) e incorporar uma pessoa dentro de uma organização que já existe.' />

      <div style={{ fontWeight: 800, color: COLOR.navy, marginBottom: '10px' }}>1. Cadastro de uma organização</div>
      <div style={grid2}>
        <Card title="📋 Caminho manual — “+ Nova organização”">
          <p style={pMuted}>Em <strong>Organizações</strong> (Painel do Distribuidor → CRM), qualquer Owner/Aprovador de uma organização não-Cliente pode criar a que vem abaixo dela na sua própria árvore:</p>
          <ul style={{ ...pMuted, margin: '8px 0', paddingLeft: '20px' }}>
            <li>Global só pode criar <strong>Distribuidores</strong>.</li>
            <li>Um Distribuidor pode criar <strong>Sub-distribuidores</strong> ou <strong>Clientes</strong>.</li>
            <li>Um Sub-distribuidor só pode criar <strong>Clientes</strong>.</li>
          </ul>
          <p style={pMuted}>Campos: Nome, Tipo, Organização superior, País e — somente se for Distribuidor — Moeda e Taxa de câmbio para USD.</p>
        </Card>
        <Card title="🙋 Caminho autoatendimento — “Solicitar acesso”">
          <p style={pMuted}>Um Cliente potencial ainda sem conta preenche o formulário público <strong>“Solicitar acesso — nova empresa”</strong>: Razão Social, identificação fiscal, situação fiscal, província, e-mail e telefone.</p>
          <p style={pMuted}>A solicitação cai em <strong>“📥 Solicitações de acesso pendentes”</strong>, visível para qualquer Distribuidor, Sub-distribuidor ou equipe da Global. Dali é possível <Pill kind="info">Atribuir organização</Pill> ou <Pill kind="bad">Rejeitar</Pill>.</p>
        </Card>
      </div>

      <Flow>
        <FlowStep n={1} state="Acordo comercial" who="Fora do portal">Negocia-se entre a FreshInset e o novo parceiro antes de mexer no sistema.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="⏳ Pendente" who="Quem a cria">A organização fica criada, mas ainda não pode operar.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="✓ Ativa" who="FreshInset Global">Botão “Ativar”, visível apenas para a Global. Único gate — sem checklist adicional.</FlowStep>
        <FlowArrow />
        <FlowStep n={4} state="Em operação" who="O novo Owner">Configura as suas próprias tabelas de preço e já pode receber Usuários, Câmaras e Tratamentos.</FlowStep>
      </Flow>

      <Callout label="Por que sempre passa pela Global">
        Mesmo quando um Distribuidor cria o seu próprio Sub-distribuidor — algo que o sistema tecnicamente permite sem pedir autorização a ninguém — essa organização nasce igualmente “Pendente” e precisa da aprovação da FreshInset Global antes de operar. É uma decisão de negócio, não uma limitação técnica.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '26px 0 10px' }}>2. Cadastro de um usuário dentro de uma organização ativa</div>
      <div style={grid2}>
        <Card title="🔗 Convite por link (mais direto)">
          <p style={pMuted}>Um Owner escolhe de antemão a organização e os Papéis de Negócio em <strong>Usuários → “🔗 Convidar por link”</strong> e compartilha o link manualmente. Quem o abre é atribuído automaticamente, sem que o Owner precise saber o e-mail da pessoa de antemão.</p>
        </Card>
        <Card title="📥 Autocadastro + atribuição manual">
          <p style={pMuted}>A pessoa cria o seu login com <strong>“Criar usuário”</strong> (só o login, ainda sem organização). Aparece em <strong>“📥 Solicitações de usuário pendentes de atribuição”</strong> — qualquer Owner pode <Pill kind="info">Atribuir</Pill> ou <Pill kind="neutral">Descartar</Pill>.</p>
        </Card>
      </div>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Papéis de Negócio</div>
      <p style={{ ...pMuted, marginBottom: '6px' }}>São independentes entre si — não formam uma escada. Uma pessoa pode ter vários ao mesmo tempo.</p>
      <Table headers={['Papel', 'O que pode fazer']} rows={[
        [<RoleTag>Owner</RoleTag>, 'Acesso total à sua organização e a tudo o que está abaixo. Único papel que administra usuários. Toda organização precisa de pelo menos um Owner em todo momento.'],
        [<RoleTag>Aprovador</RoleTag>, 'Revisa, define o preço final e aprova ou rejeita Tratamentos enviados pelas organizações abaixo.'],
        [<RoleTag>Planejador</RoleTag>, 'Cria, edita e envia Tratamentos — usa a Calculadora e carrega o Plano de Safra.'],
        [<RoleTag>Operador</RoleTag>, 'Registra a aplicação física do tratamento e envia a verificação MatriSure.'],
        [<RoleTag>Viewer</RoleTag>, 'Somente leitura de Tratamentos e histórico — não pode criar nem modificar nada.'],
      ]} />

      <Callout label="Sucessão do Owner">
        Em um Sub-distribuidor ou Cliente, substituir o Owner é totalmente autônomo. Em um Distribuidor, precisa da aprovação da FreshInset Global — o mesmo gate do seu cadastro original.
      </Callout>
    </>
  ),

  plan: () => (
    <>
      <PageHeader eyebrow="Fluxo crítico · Planejamento" title="Planejamento de safra"
        intro="O Plano de Safra é uma tabela não vinculante para esboçar toda a campanha — todas as câmaras, todas as datas — antes de se comprometer com um Tratamento real. Convive com a Calculadora sem substituí-la." />

      <Card title="O que contém cada linha do plano">
        <Table headers={['Campo', 'Detalhe']} rows={[
          ['Câmara', 'Uma das câmaras próprias do Cliente.'],
          ['Cultura', 'Preenchida ou atualizada junto com a câmara.'],
          ['Data estimada', 'Quando se planeja tratar essa câmara.'],
          ['Dose (ppb)', 'Opcional nesta etapa.'],
          ['Produto', 'Powder / Tablets / Sem decidir.'],
          ['Custo indicativo', 'Recalculado ao vivo contra o preço vigente — nunca é um compromisso.'],
          ['Status', <>{<Pill kind="warn">Planejada</Pill>} ou {<Pill kind="ok">Convertida</Pill>}</>],
        ]} />
      </Card>

      <div style={grid2}>
        <Card title="Carga linha a linha">
          <p style={pMuted}>Tabela editável diretamente na tela, mais um multisseletor com <strong>“Aplicar às selecionadas”</strong> para atribuir Produto em lote.</p>
        </Card>
        <Card title="Carga em massa por Excel">
          <p style={pMuted}>Modelo para baixar (Frigorífico, Câmara, Volume, Dose, Data, Cultura). Detecta duplicatas por Câmara + Data e pergunta se soma ou substitui.</p>
        </Card>
      </div>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>De linha planejada a Tratamento real</div>
      <Flow>
        <FlowStep n={1} state="Selecionar linhas" who="Cliente">Você escolhe uma ou várias linhas com status “Planejada”.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="“Converter em Tratamento”" who="Cliente">Cada linha passa, uma por uma, pela Calculadora real.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="Confirmar" who="Cliente">Revisa-se/ajusta-se e confirma-se. Entra direto como Tratamento Enviado.</FlowStep>
      </Flow>

      <Callout kind="real" label="🔧 Estado real">
        Não há uma etapa de Rascunho separada na conversão — passar pela Calculadora ao converter <em>é</em> a etapa de revisão, por design. Converter uma linha não reserva estoque nem dispara nenhuma aprovação por si só.
      </Callout>

      <div style={{ ...grid2, marginTop: '18px' }}>
        <Card title="🤝 Rascunho montado pelo Distribuidor">
          <p style={pMuted}>Um Distribuidor ou Sub-distribuidor pode montar um Plano de Safra estimado para um Cliente que ainda não carregou o próprio. Fica invisível até tocar em “Compartilhar”, que copia as linhas para o plano real do Cliente.</p>
        </Card>
        <Card title="📊 Visão consolidada (rollup)">
          <p style={pMuted}>O Distribuidor vê, somente leitura, o plano de todos os seus Clientes ao mesmo tempo — útil para alocar geradores antes de virar Tratamento.</p>
        </Card>
      </div>
    </>
  ),

  calculadora: ({ onNavigate }) => (
    <>
      <PageHeader eyebrow="Fluxo crítico · Decisão de dose" title="Calculadora, DoseRight e Knowledge Base"
        intro='As três ferramentas para decidir e calcular uma dose antes de criar um Tratamento.' />

      <Card title="🧮 Calculadora de dose">
        <p style={pMuted}>Escolha a sua <strong>Câmara</strong> e, se quiser, dê a ela um <strong>Nome personalizado</strong> para identificá-la melhor. Em <strong>Dose alvo (ppb)</strong> informe a dose que quer aplicar nessa câmara — se não tiver certeza de qual usar, o atalho <strong>“Padrão (1.000 ppb)”</strong> carrega o valor de referência habitual (1.000 ppb = 0,067 g de MatriPowder 3,3% por m³), ou você pode consultar o DoseRight (veja abaixo) para receber uma sugestão de dose conforme a sua fruta e a sua câmara.</p>
        <p style={pMuted}>Uma barra superior mostra se o cálculo está usando o seu <strong>preço negociado</strong> com o seu Distribuidor ou a <strong>lista padrão</strong>. Ao tocar em “Calcular e comparar alternativas” você sempre verá as 3 opções lado a lado (Powder Round-Up, Powder Round-Down, Tablets) com preço real, para comparar antes de decidir. Escolher uma e confirmar cria o Tratamento — veja <Link to="tratamientos" onNavigate={onNavigate}>Ciclo de um Tratamento</Link>.</p>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>🔬 O que é o DoseRight?</div>
      <p style={{ ...pMuted, marginBottom: '10px' }}>O DoseRight é uma ferramenta de consulta científica: revisa a informação bibliográfica publicada sobre 1-MCP (maturação na colheita, condições de armazenamento, tempo desde a colheita) e, a partir disso, sugere uma dose para o seu caso específico. Ele não decide por você — é um assistente para tomar uma decisão mais informada. <strong>A decisão final sobre qual dose aplicar é sempre sua.</strong> Abre-se a partir do aviso “Não sabe qual dose usar?” dentro da própria Calculadora.</p>
      <Flow>
        <FlowStep n={1} state="Abrir o DoseRight" who="Janela pop-up">Abre em uma janela separada, não incorporada — necessário para poder devolver a dose sugerida à Calculadora.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="Ajustar parâmetros" who="Você">Você informa a maturação na colheita, as condições de armazenamento e as horas desde a colheita — os dados reais da sua fruta.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state='"Usar esta dose"' who="Você">A dose sugerida volta a preencher o campo ppb da Calculadora — você ainda pode ajustá-la antes de confirmar.</FlowStep>
      </Flow>

      <Callout label="O DoseRight sugere, não prescreve">
        O DoseRight ajuda revisando a evidência científica disponível — mas a responsabilidade final de escolher a dose é sempre sua, não da ferramenta. O Tratamento guarda internamente de onde veio a dose (<code>manual</code> ou <code>doseright</code>) para rastreabilidade, embora hoje isso não apareça como etiqueta visível na tela.
      </Callout>

      <Card title="📚 MaTri Knowledge Base" style={{ marginTop: '18px' }}>
        <p style={pMuted}>É uma coleção de trabalhos científicos publicados sobre o efeito de diferentes parâmetros fisiológicos (maturação, firmeza, atmosfera de armazenamento, temperatura, tempo desde a colheita etc.) no uso de 1-MCP — a mesma evidência em que o DoseRight se apoia para as suas sugestões. É um item fixo do menu lateral (“📚 MaTri Knowledge Base”) que abre esse material em uma nova aba, disponível para qualquer usuário do portal.</p>
      </Card>
    </>
  ),

  tratamientos: ({ onNavigate, isCustomer }) => (
    <>
      <PageHeader eyebrow="Fluxo crítico · Operação" title="Ciclo de vida de um Tratamento"
        intro="O Tratamento é a entidade central do negócio: guarda dose, preço congelado, histórico e evidência científica do início ao fim." />

      <Flow>
        <FlowStep n={1} state="Enviado" who="👤 Planejador">Criado a partir da Calculadora ou convertendo uma linha do Plano de Safra.</FlowStep>
        <FlowArrow />
        <FlowStep n={2} state="Aprovado" who="✅ Aprovador">Confirma ou ajusta o preço final — congelado para sempre.</FlowStep>
        <FlowArrow />
        <FlowStep n={3} state="Aplicado" who="🔧 Operador">Registra a data/hora real de início e fim.</FlowStep>
        <FlowArrow />
        <FlowStep n={4} state="Concluído" who="📸 Cliente / Aprovador">O MatriSure envia a foto e confirma o resultado. Fechado e imutável.</FlowStep>
      </Flow>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', fontSize: '12.5px', color: COLOR.muted, flexWrap: 'wrap' }}>
        <span>Também pode terminar em:</span>
        <Pill kind="bad">✗ Rejeitado</Pill> <span>— o Aprovador rejeita com motivo obrigatório.</span>
      </div>

      <Callout kind="real" label="🔧 Estado real">
        Hoje não existe um status de <strong>Rascunho</strong> editável: um Tratamento nasce diretamente em “Enviado”. Também não há botão para editar e reenviar um Tratamento Rejeitado. “Cancelado” existe no modelo de dados, mas hoje não há botão na interface para chegar a ele.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '24px 0 10px' }}>Passo a passo</div>
      <ol style={{ ...pMuted, paddingLeft: '20px' }}>
        <li style={{ marginBottom: '10px' }}><strong>Criação (Planejador).</strong> Câmara + dose, sempre com as 3 alternativas visíveis. Ao confirmar, entra na fila do Aprovador.</li>
        <li style={{ marginBottom: '10px' }}><strong>Aprovação (Aprovador/Owner, Painel do Distribuidor).</strong> <Pill kind="ok">✓ Aprovar</Pill> define o preço final. <Pill kind="bad">✗ Rejeitar</Pill> pede um motivo visível para o Cliente.</li>
        <li style={{ marginBottom: '10px' }}><strong>Aplicação física (Operador).</strong> Informa data/hora completas de início e fim.</li>
        <li style={{ marginBottom: '10px' }}><strong>Verificação MatriSure.</strong> Foto ao vivo, autoconfirmação ou “pedir ajuda” — veja <Link to="matrisure" onNavigate={onNavigate}>MatriSure</Link>.</li>
        <li><strong>Concluído.</strong> Preço e detalhamento de sachês ficam congelados para sempre.</li>
      </ol>

      <Callout label="Quem vê a fila de aprovação">
        Somente Owner e Aprovador (do lado do seu Distribuidor) veem “Tratamentos pendentes de aprovação”.{!isCustomer && <> Mais detalhes em <Link to="roles" onNavigate={onNavigate}>Papéis e permissões</Link>.</>}
      </Callout>
    </>
  ),

  precios: () => (
    <>
      <PageHeader eyebrow="Fluxo crítico · Comercial" title="Gestão de preços"
        intro="Cada Distribuidor monta a sua própria lista de preços do zero, na sua própria moeda — nunca é herdada da FreshInset Global." />

      <Card title='As 4 tabelas — Painel do Distribuidor → "💲 Gestão de preços"'>
        <Table headers={['Tabela', 'Unidade', 'Segmentada por']} rows={[
          ['Produto', '$/m³', 'SKU (Powder / Tablets) × faixa de volume'],
          ['Serviço de aplicação', '$/tratamento', 'Faixa — somente Powder com serviço gerenciado'],
          ['Gerador', 'compra $/unidade', 'Faixa'],
          ['Faixas de volume', '—', 'Editáveis por Distribuidor (0–600 / 600–1.200 / 1.200–1.800 / 1.800+ m³ por padrão)'],
        ]} />
        <p style={{ ...pMuted, marginTop: '10px' }}>Somente Owner e Aprovador editam estas tabelas. A Global as vê somente leitura; um Sub-distribuidor tem controle total sobre as suas próprias.</p>
      </Card>

      <Callout label="Quem define o preço de quem">
        Quando um Cliente pertence a um Sub-distribuidor que montou o seu próprio preço, esse preço prevalece. Se não configurou faixas próprias, usa-se a do ancestral mais próximo que tenha configurado.
      </Callout>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Preço negociado por Cliente</div>
      <p style={{ ...pMuted, marginBottom: '10px' }}>Botão <strong>“💲 Preço”</strong> em Organizações, visível somente para o Owner/Aprovador da organização pai imediata.</p>
      <Table headers={['Ordem', 'Mecanismo', 'Uso típico']} rows={[
        ['1', 'Preço fixo combinado ($/m³)', 'Contas grandes — substitui toda a tabela de faixas.'],
        ['2', '% de desconto sobre a lista', 'Contas médias.'],
        ['3', 'Preço de lista, sem alterações', 'Contas pequenas ou de maior risco de cobrança.'],
      ]} />
      <p style={pMuted}>Um acordo pode incluir um <strong>volume mínimo comprometido</strong> — puramente informativo, nunca bloqueia o preço por si só.</p>

      <Callout kind="real" label="📌 O congelamento (snapshot)">
        Ao aprovar um Tratamento, o preço final e o detalhamento de sachês ficam fotografados para sempre — junto com o equivalente em USD. Mudanças futuras de preço, catálogo ou câmbio nunca alteram Tratamentos já aprovados.
      </Callout>
    </>
  ),

  matrisure: () => (
    <>
      <PageHeader eyebrow="Operação e qualidade" title="MatriSure — verificação de dose"
        intro="O Kit MaTriSure é a sua confirmação visual de que o tratamento com 1-MCP atingiu a concentração correta dentro da câmara — uma “testemunha silenciosa” que só responde quando a dose realmente chegou." />

      <Card title="🔬 Como funciona">
        <p style={pMuted}>Dentro do Kit há uma tira indicadora com um corante patenteado que reage especificamente com o gás 1-MCP — não se observou nenhuma reação detectável frente a outros gases presentes na câmara, como o etileno. À medida que o 1-MCP se acumula na câmara selada, o corante vai mudando de cor até confirmar que a dose foi atingida.</p>
        <ul style={{ ...pMuted, margin: '10px 0 0', paddingLeft: '20px' }}>
          <li>A resposta é <strong>cumulativa</strong> durante todo o tratamento — não é uma reação instantânea.</li>
          <li>Uma mudança de cor notável pode começar <strong>antes</strong> de chegar à dose alvo final.</li>
          <li>O indicador muda <strong>completamente</strong> de cor na concentração correta, ou acima dela.</li>
          <li>A cor final confirma que a câmara recebeu a dose de 1-MCP prevista.</li>
        </ul>
      </Card>

      <Card title="⏱️ Tempos e boas práticas">
        <p style={pMuted}>As Tabletes ou o Pó MaTri liberam o 1-MCP na câmara em aproximadamente <strong>1 hora</strong>. Porém, um tratamento eficaz da fruta precisa de um período de exposição completo de <strong>24 horas</strong>, com a câmara selada durante todo esse tempo.</p>
        <p style={pMuted}>Passadas as 24 horas, retire o kit e avalie a cor final: se mudou de cor ao terminar o tratamento, a dose correta foi atingida e a sua fruta recebeu a proteção prevista.</p>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Como enviar a verificação no portal</div>
      <Card>
        <p style={pMuted}>A foto é tirada ao vivo pela câmera do dispositivo — não existe botão para enviar da galeria. É intencional: evita carregar uma foto antiga para adulterar a verificação.</p>
      </Card>

      <div style={grid2}>
        <Card title="✓ Autoconfirmação (o caso mais comum)">
          <p style={pMuted}>Você envia a foto e marca <Pill kind="ok">✓ Dose atingida</Pill> ou <Pill kind="bad">✗ Não atingida</Pill> conforme a cor que vê.</p>
        </Card>
        <Card title="🙋 Pedir ajuda (se não tiver certeza)">
          <p style={pMuted}>Se não tiver certeza de como ler a tira, marque “pedir ajuda” ao enviar a foto — o seu Distribuidor confirma o resultado por você.</p>
        </Card>
      </div>

      <Callout label="“Não atingida” não bloqueia o fechamento">
        Um resultado “Não atingida” ainda leva o Tratamento a Concluído — fica registrado como alerta, mas nunca impede de fechá-lo.
      </Callout>

      <Callout kind="real" label="🔧 Estado real / futuro">
        A classificação automática pela cor da tira é um item de roadmap futuro — hoje a leitura é feita por você (ou pelo seu Distribuidor, se pediu ajuda). O guia ilustrado completo do Kit ainda não está carregado em Documentos — enquanto isso, qualquer dúvida sobre o procedimento pode ser tirada diretamente com o seu Distribuidor.
      </Callout>
    </>
  ),

  firmeza: ({ isCustomer }) => (
    <>
      <PageHeader eyebrow="Operação e qualidade" title="Avaliação de Firmeza"
        intro="Diferente do MatriSure: o MatriSure confirma a concentração dentro da câmara; a Avaliação de Firmeza confirma o efeito sobre a fruta (Testemunha vs. Matri)." />

      {isCustomer ? (
        <Card title="🍐 Um serviço adicional opcional">
          <p style={pMuted}>A Avaliação de Firmeza é um serviço adicional que você pode contratar com o seu Distribuidor — não faz parte automática do Tratamento. Se contratar, aqui você verá o relatório de acompanhamento das amostras (Testemunha sem tratar vs. Matri tratada) ao longo dos dias de pós-colheita, incluindo o gráfico de perda de firmeza e, se disponível, o PDF assinado.</p>
        </Card>
      ) : (
        <>
          <Card title="Quem pode carregá-la">
            <p style={pMuted}>Somente equipe não-Cliente na cadeia de ancestrais do Tratamento, com papel Owner, Aprovador ou Operador. O Cliente e o resto da cadeia só podem ver e baixar o PDF assinado.</p>
          </Card>

          <div style={grid2}>
            <Card title="Onde se carrega">
              <p style={pMuted}>Painel do Distribuidor → aba Tratamentos → botão “📊 + Avaliação”, sobre um Tratamento Aplicado ou Concluído.</p>
            </Card>
            <Card title="O que calcula sozinha">
              <p style={pMuted}>A taxa de perda de firmeza e o seu gráfico são derivados automaticamente das amostras carregadas.</p>
            </Card>
          </div>
        </>
      )}
    </>
  ),

  generadores: () => (
    <>
      <PageHeader eyebrow="Operação e qualidade" title="Geradores"
        intro="Relevante somente para o MatriPowder — o MatriTablets nunca precisa de gerador." />

      <Card title="Ciclo de vida de uma unidade">
        <Flow>
          <FlowStep state="Disponível">Recém-registrada.</FlowStep>
          <FlowArrow />
          <FlowStep state="Despachada">Checklist prévio obrigatório antes de sair (venda a Cliente).</FlowStep>
          <FlowArrow />
          <FlowStep state="Em serviço → Reparada">Ou diretamente Fora de serviço.</FlowStep>
        </Flow>
      </Card>

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Ações em “Meus geradores”</div>
      <Table headers={['Ação', 'Quem', 'O que acontece']} rows={[
        ['Registrar unidade nova', 'Somente Global ou Distribuidor', 'Um Sub-distribuidor nunca origina estoque novo.'],
        ['Transferência a sub-distribuidor', 'Distribuidor', 'Simples troca de dono, sem checklist.'],
        ['Vender a cliente', 'Distribuidor/Sub-distribuidor', 'Checklist prévio obrigatório. A propriedade passa ao Cliente.'],
        ['Marcar como devolvido', 'Distribuidor/Sub-distribuidor', 'Encerra um aluguel existente de antes de a modalidade ser descontinuada. Já não se podem iniciar aluguéis novos.'],
      ]} />

      <Callout label="Checklist prévio ao despacho (bloqueante)">
        Bateria carregada, lacres intactos, teste de partida, manutenção em dia. A unidade não pode passar a “Despachada” com o checklist incompleto.
      </Callout>

      <Callout kind="real" label="🔧 Estado real — aluguel descontinuado">
        Gerava carga demais de suporte e manutenção — hoje só restam Comprar ou Serviço gerenciado como alternativas à propriedade própria.
      </Callout>

      <Card title="Calculadora Comprar vs. Serviço gerenciado" style={{ marginTop: '18px' }}>
        <p style={pMuted}>Visão do Cliente — pode ser alimentada com dados reais do Plano de Safra. Um Distribuidor ou a Global vê diretamente o estado da sua própria frota.</p>
      </Card>

      <Callout kind="real" label="📄 Guia de uso — em preparação">
        Ainda não há um guia de uso do gerador carregado no portal. Assim que estiver pronto, você poderá abri-lo diretamente daqui.
      </Callout>
    </>
  ),

  inventario: () => (
    <>
      <PageHeader eyebrow="Operação e qualidade" title="Estoque e Catálogo de SKU"
        intro="Ferramenta interna do Distribuidor — hoje não tem detalhamento por Sub-distribuidor nem é visível para Clientes." />

      <div style={grid2}>
        <Card title="🏷️ Catálogo de SKU">
          <p style={pMuted}><strong>MatriPowder:</strong> tamanhos de sachê editáveis (padrão 100g/50g/20g/10g).</p>
          <p style={pMuted}><strong>MatriTablets:</strong> tamanhos de envelope editáveis, não divisíveis (padrão 10/15/50).</p>
        </Card>
        <Card title="📦 Estoque">
          <p style={pMuted}>O MatriTablets é rastreado em dois pools: <strong>envelopes</strong> fechados e <strong>soltas</strong>. Abrir um envelope é sempre manual.</p>
        </Card>
      </div>

      <Callout label="Desconto automático">
        Ao passar a “Aplicado”: o Powder subtrai do detalhamento de sachês; o Tablets subtrai somente do pool solto. O estoque pode ficar negativo — sinal visível, não se esconde.
      </Callout>

      <p style={pMuted}>O ajuste manual continua disponível para receber estoque novo, abrir um envelope ou corrigir uma contagem física.</p>
    </>
  ),

  documentos: () => (
    <>
      <PageHeader eyebrow="Suporte" title="Documentos" intro="A FreshInset Global envia um documento uma única vez e o atribui a quem precisa — mais ninguém precisa reenviá-lo." />
      <Card title="Quem envia e atribui">
        <p style={pMuted}>Somente Owner/Aprovador da Global. Ao enviar um arquivo, você escolhe a quais Distribuidores ele fica atribuído — com um atalho “selecionar todos de um país” para não repetir o envio quando o mesmo documento (ex.: instruções de uso do MatriTablets) se aplica a vários.</p>
      </Card>
      <Card title="Quem vê">
        <p style={pMuted}>Um documento atribuído a um Distribuidor aparece automaticamente para tudo o que está abaixo dele — Sub-distribuidores e Clientes — igual a Tratamentos ou Preços. Ninguém precisa reenviar.</p>
      </Card>
      <Callout kind="real" label="🔧 Estado real">
        Não há histórico de versões: substituir o arquivo de um documento sobrescreve o anterior, sem deixar uma versão antiga disponível. Cada Organização enviar a sua própria documentação (fichas de segurança, registros regulatórios locais) ainda não foi construído — hoje só existe o lado da FreshInset Global.
      </Callout>
    </>
  ),

  notificaciones: () => (
    <>
      <PageHeader eyebrow="Suporte" title="Notificações" intro="Sininho 🔔 no cabeçalho — contador de não lidas, atualizado a cada 30 segundos." />
      <Card title="Eventos que notificam hoje">
        <ul style={{ ...pMuted, margin: 0, paddingLeft: '20px' }}>
          <li>Tratamento enviado → avisa o Aprovador/Owner do pai imediato.</li>
          <li>Tratamento aprovado ou rejeitado → avisa quem o criou.</li>
          <li>Nova solicitação de acesso de empresa.</li>
          <li>Novo cadastro de usuário pendente de atribuição.</li>
          <li>MatriSure — o Cliente pediu ajuda.</li>
          <li>Convite por link resgatado.</li>
        </ul>
      </Card>
      <Callout kind="real" label="🔧 Estado real">
        Só existe o canal dentro do app — ainda não há envio por e-mail (falta um provedor SMTP próprio). Os alertas baseados em tempo estão documentados, mas ainda não foram construídos.
      </Callout>
    </>
  ),

  roles: () => (
    <>
      <PageHeader eyebrow="Referência" title="Papéis e permissões" intro="O que cada Papel de Negócio vê e pode fazer dentro do Painel do Distribuidor — reforçado no nível do banco de dados, não apenas escondido na tela." />

      <Callout label="🔎 Detalhe completo">
        Para o detalhe tela por tela de cada combinação de Tipo de organização × Papel de Negócio, veja a{' '}
        <a href="https://claude.ai/code/artifact/dcfbfb24-5589-4101-bfa7-00a002dd71a0" target="_blank" rel="noopener noreferrer" style={{ color: COLOR.infoInk, fontWeight: 700 }}>Matriz de Papéis e Permissões</a>.
      </Callout>

      <Table headers={['Papel', 'CRM/Estoque/Catálogo/Preços', 'Aprovar/Rejeitar', 'Tratamentos', 'Avaliação de Firmeza']} rows={[
        [<RoleTag>Owner</RoleTag>, <Pill kind="ok">Controle total</Pill>, <Pill kind="ok">Sim</Pill>, 'Vê tudo', 'Sim'],
        [<RoleTag>Aprovador</RoleTag>, <Pill kind="ok">Controle total</Pill>, <Pill kind="ok">Sim</Pill>, 'Vê tudo', 'Sim'],
        [<RoleTag>Planejador</RoleTag>, <Pill kind="neutral">Sem acesso</Pill>, <Pill kind="bad">Não</Pill>, 'Somente esta aba', 'Não'],
        [<RoleTag>Operador</RoleTag>, <Pill kind="neutral">Sem acesso</Pill>, <Pill kind="bad">Não</Pill>, 'Sem coluna de preço', 'Sim'],
        [<RoleTag>Viewer</RoleTag>, <Pill kind="neutral">Sem acesso</Pill>, <Pill kind="bad">Não</Pill>, 'Somente leitura', 'Não'],
      ]} />

      <div style={{ fontWeight: 800, color: COLOR.navy, margin: '20px 0 6px' }}>Nuances conforme o tipo de organização</div>
      <Table headers={['Tipo', 'Estoque', 'Catálogo de SKU', 'Preços']} rows={[
        ['🌐 Global', <Pill kind="warn">Somente leitura</Pill>, <Pill kind="ok">Controle total</Pill>, <Pill kind="warn">Somente leitura</Pill>],
        ['📦 Distribuidor', <Pill kind="ok">Controle total</Pill>, <Pill kind="ok">Controle total</Pill>, <Pill kind="ok">Controle total</Pill>],
        ['🏬 Sub-distribuidor', <Pill kind="ok">Controle total (próprio)</Pill>, <Pill kind="warn">Somente leitura</Pill>, <Pill kind="ok">Controle total (próprio)</Pill>],
      ]} />

      <Callout label="Do lado do Cliente">
        Hoje, dentro de uma organização Cliente, o Aprovador não se comporta de forma diferente do Owner — ainda não existe uma tela própria em que a diferença importe.
      </Callout>
    </>
  ),

  glosario: ({ isCustomer }) => {
    const terms = [
      ['Organização', 'Nó da árvore comercial: FreshInset Global, Distribuidor, Sub-distribuidor ou Cliente.'],
      ['Tratamento', 'O ciclo completo de uma aplicação de MaTri, da criação à verificação confirmada.'],
      ['Plano de Safra', 'Tabela não vinculante para esboçar uma campanha antes de se comprometer com Tratamentos reais.'],
      ['Linha do plano', 'Uma linha do Plano de Safra — câmara + data + dose, conversível em Tratamento.'],
      ['Câmara', 'Local físico onde se aplica o tratamento; histórico completo entre safras.'],
      ['Gerador', 'Equipamento profissional para aplicações com MatriPowder, com ID individual próprio.'],
      ['MatriSure', 'Kit de tiras que confirma com foto ao vivo se a dose foi atingida.'],
      ['Avaliação de Firmeza', 'Comparação Testemunha vs. Matri da firmeza da fruta ao longo dos dias de pós-colheita.'],
      ...(isCustomer ? [] : [
        ['Faixa de volume', 'Intervalo de m³ usado para segmentar preços.'],
        ['Preço negociado', 'Acordo próprio de um Cliente específico que substitui a lista geral.'],
        ['Snapshot de preço', 'Preço e detalhamento de sachês congelados no momento de aprovar um Tratamento.'],
        ['Câmbio para USD', 'Taxa de câmbio própria de cada Distribuidor, usada para consolidar o dashboard da FreshInset Global.'],
      ]),
    ]
    return (
      <>
        <PageHeader eyebrow="Referência" title="Glossário" intro="" />
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

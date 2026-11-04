'use strict';
// 1.0.5: idioma do painel (Perfil > Idioma): Português (Brasil), English, Español, Français, Русский.
// Traduz os textos fixos da tela (menu, títulos, botões, colunas, campos) pelo dicionário abaixo, inclusive o que
// aparece depois (janelas, abas). Textos com dados (nomes, valores, datas) e frases longas continuam em português.
// Para traduzir mais um texto: acrescente uma linha "português|english|español|français|русский".
(function () {
  const LANGS = {'pt-BR': 'Português (Brasil)', en: 'English', es: 'Español', fr: 'Français', ru: 'Русский'};
  const COL = {en: 1, es: 2, fr: 3, ru: 4};
  const RAW = `
Painel de controle|Control panel|Panel de control|Tableau de bord|Панель управления
Clientes|Customers|Clientes|Clients|Клиенты
Fidelidade|Loyalty|Fidelidad|Fidélité|Лояльность
Corujão/Viradão|All-nighter|Maratón nocturno|Nuit blanche|Ночной марафон
Transferir/Remover|Transfer/Remove|Transferir/Quitar|Transférer/Retirer|Перевод/Списание
Sessão|Sessions|Sesiones|Sessions|Сеансы
Log|Log|Registro|Journal|Журнал
Faturas|Invoices|Facturas|Factures|Счета
Estatística|Statistics|Estadísticas|Statistiques|Статистика
Caixa|Cash register|Caja|Caisse|Касса
Produtos/Serviços|Products/Services|Productos/Servicios|Produits/Services|Товары/Услуги
Ranking|Ranking|Ranking|Classement|Рейтинг
Configuração|Settings|Configuración|Paramètres|Настройки
// GERENCIAMENTO|// MANAGEMENT|// GESTIÓN|// GESTION|// УПРАВЛЕНИЕ
// CENTRAL DE OPERAÇÕES|// OPERATIONS CENTER|// CENTRAL DE OPERACIONES|// CENTRE DES OPÉRATIONS|// ЦЕНТР УПРАВЛЕНИЯ
Perfil|Profile|Perfil|Profil|Профиль
Sair ↗|Log out ↗|Salir ↗|Déconnexion ↗|Выйти ↗
Servidor local online|Local server online|Servidor local en línea|Serveur local en ligne|Локальный сервер в сети
Administrador principal|Main administrator|Administrador principal|Administrateur principal|Главный администратор
Administrador|Administrator|Administrador|Administrateur|Администратор
Operador|Operator|Operador|Opérateur|Оператор
Controle de Caixas|Cash control|Control de cajas|Gestion des caisses|Управление кассой
Produtos e Serviços|Products and Services|Productos y Servicios|Produits et Services|Товары и услуги
Estações em uso|Stations in use|Estaciones en uso|Postes utilisés|Станции заняты
Acompanhamento em tempo real|Real-time monitoring|Seguimiento en tiempo real|Suivi en temps réel|Мониторинг в реальном времени
Disponíveis|Available|Disponibles|Disponibles|Свободны
Prontas para iniciar|Ready to start|Listas para iniciar|Prêts à démarrer|Готовы к запуску
Caixa de hoje|Today's cash|Caja de hoy|Caisse du jour|Касса за сегодня
Valor da hora|Hourly rate|Precio por hora|Tarif horaire|Цена часа
Sua arena, ao vivo|Your arena, live|Tu arena, en vivo|Votre arène, en direct|Ваша арена в реальном времени
Organizar|Sort|Ordenar|Trier|Сортировка
Visitantes em grupo|Group visitors|Visitantes en grupo|Visiteurs en groupe|Групповые гости
Ações dos PCs|PC actions|Acciones de los PC|Actions des PC|Действия с ПК
Nova estação|New station|Nueva estación|Nouveau poste|Новая станция
Disponível|Available|Disponible|Disponible|Свободно
DISPONÍVEL|AVAILABLE|DISPONIBLE|DISPONIBLE|СВОБОДНО
SEM CONEXÃO|OFFLINE|SIN CONEXIÓN|HORS LIGNE|НЕТ СВЯЗИ
EM USO|IN USE|EN USO|OCCUPÉ|ЗАНЯТО
LIVRE|FREE|LIBRE|LIBRE|СВОБОДНО
Pronta para jogar|Ready to play|Lista para jugar|Prêt à jouer|Готово к игре
Nenhum cliente conectado|No customer connected|Ningún cliente conectado|Aucun client connecté|Нет подключённого клиента
Início|Start|Inicio|Début|Начало
Término previsto|Expected end|Fin prevista|Fin prévue|Плановое окончание
Iniciar sessão →|Start session →|Iniciar sesión →|Démarrer la session →|Начать сеанс →
Visitante|Guest|Visitante|Visiteur|Гость
Configurar|Configure|Configurar|Configurer|Настроить
Layout do login|Login layout|Diseño del inicio de sesión|Écran de connexion|Экран входа
Remover computador|Remove computer|Quitar computadora|Retirer l'ordinateur|Удалить компьютер
Remover console|Remove console|Quitar consola|Retirer la console|Удалить консоль
Parear TV|Pair TV|Emparejar TV|Associer la TV|Сопряжение ТВ
Informar PIN|Enter PIN|Introducir PIN|Saisir le PIN|Ввести PIN
Importar pareamento|Import pairing|Importar emparejamiento|Importer l'association|Импорт сопряжения
Testar HDMI|Test HDMI|Probar HDMI|Tester HDMI|Проверить HDMI
Controle do PC|PC control|Control del PC|Contrôle du PC|Управление ПК
Bloquear|Lock|Bloquear|Verrouiller|Заблокировать
Desbloquear|Unlock|Desbloquear|Déverrouiller|Разблокировать
Reiniciar|Restart|Reiniciar|Redémarrer|Перезагрузить
Desligar|Shut down|Apagar|Éteindre|Выключить
Visualizar tela|View screen|Ver pantalla|Voir l'écran|Просмотр экрана
Parar visualização|Stop viewing|Detener vista|Arrêter l'affichage|Остановить просмотр
Clientes da arena|Arena customers|Clientes de la arena|Clients de l'arène|Клиенты арены
Importar planilha|Import spreadsheet|Importar hoja de cálculo|Importer un tableur|Импорт таблицы
+ Novo cliente|+ New customer|+ Nuevo cliente|+ Nouveau client|+ Новый клиент
Novo cliente|New customer|Nuevo cliente|Nouveau client|Новый клиент
Editar cliente|Edit customer|Editar cliente|Modifier le client|Изменить клиента
Nome completo|Full name|Nombre completo|Nom complet|Полное имя
Usuário/Nick|Username|Usuario/Nick|Pseudo|Имя пользователя
Senha (4 a 20 caracteres)|Password (4 to 20 characters)|Contraseña (4 a 20 caracteres)|Mot de passe (4 à 20 caractères)|Пароль (от 4 до 20 символов)
CPF (opcional)|CPF (optional)|CPF (opcional)|CPF (facultatif)|CPF (необязательно)
Telefone|Phone|Teléfono|Téléphone|Телефон
Email|Email|Correo electrónico|E-mail|Эл. почта
Observações|Notes|Observaciones|Remarques|Заметки
Cliente ativo|Active customer|Cliente activo|Client actif|Активный клиент
Ativar programa fidelidade|Enable loyalty program|Activar programa de fidelidad|Activer le programme de fidélité|Включить программу лояльности
Salvar cadastro|Save customer|Guardar registro|Enregistrer|Сохранить
Tempo disponível|Available time|Tiempo disponible|Temps disponible|Доступное время
Medalhas de fidelidade|Loyalty medals|Medallas de fidelidad|Médailles de fidélité|Медали лояльности
Medalhas|Medals|Medallas|Médailles|Медали
ESCOLHA UMA PROMOÇÃO|CHOOSE A PROMOTION|ELIJA UNA PROMOCIÓN|CHOISISSEZ UNE PROMOTION|ВЫБЕРИТЕ АКЦИЮ
Nenhuma promoção ativa.|No active promotion.|Ninguna promoción activa.|Aucune promotion active.|Нет активных акций.
Informar recarga|Top-up by|Recarga por|Recharge par|Пополнение
Em minutos|In minutes|En minutos|En minutes|В минутах
Em valor|By amount|Por valor|Par montant|По сумме
Quantidade de minutos|Number of minutes|Cantidad de minutos|Nombre de minutes|Количество минут
Valor da recarga|Top-up amount|Valor de la recarga|Montant de la recharge|Сумма пополнения
Forma de pagamento|Payment method|Forma de pago|Mode de paiement|Способ оплаты
Selecione|Select|Seleccione|Sélectionnez|Выберите
Dinheiro|Cash|Efectivo|Espèces|Наличные
Pix|Pix|Pix|Pix|Pix
Cartão|Card|Tarjeta|Carte|Карта
Cartão (Crédito)|Card (Credit)|Tarjeta (Crédito)|Carte (Crédit)|Карта (кредит)
Cartão (Débito)|Card (Debit)|Tarjeta (Débito)|Carte (Débit)|Карта (дебет)
Pagamento combinado (até 3 formas)|Split payment (up to 3 methods)|Pago combinado (hasta 3 formas)|Paiement combiné (jusqu'à 3 modes)|Комбинированная оплата (до 3 способов)
Forma|Method|Forma|Mode|Способ
Iniciar após a recarga|Start after top-up|Iniciar tras la recarga|Démarrer après la recharge|Начать после пополнения
Guardar no saldo do cliente|Keep in customer balance|Guardar en el saldo del cliente|Garder sur le solde du client|Оставить на балансе клиента
Registrar recarga|Register top-up|Registrar recarga|Enregistrer la recharge|Записать пополнение
Valor|Amount|Valor|Montant|Сумма
Data|Date|Fecha|Date|Дата
Data e hora|Date and time|Fecha y hora|Date et heure|Дата и время
Motivo|Reason|Motivo|Motif|Причина
Categoria|Category|Categoría|Catégorie|Категория
Ações|Actions|Acciones|Actions|Действия
Tipo|Type|Tipo|Type|Тип
Remover|Remove|Quitar|Retirer|Удалить
Excluir|Delete|Eliminar|Supprimer|Удалить
Status|Status|Estado|Statut|Статус
Confirmar|Confirm|Confirmar|Confirmer|Подтвердить
Cancelar|Cancel|Cancelar|Annuler|Отмена
Nome|Name|Nombre|Nom|Имя
Cliente|Customer|Cliente|Client|Клиент
Descrição|Description|Descripción|Description|Описание
Senha|Password|Contraseña|Mot de passe|Пароль
Funcionário|Employee|Empleado|Employé|Сотрудник
Tempo|Time|Tiempo|Temps|Время
Pagamento|Payment|Pago|Paiement|Оплата
Sessões|Sessions|Sesiones|Sessions|Сеансы
Editar|Edit|Editar|Modifier|Изменить
Situação|Situation|Situación|Situation|Состояние
Minutos|Minutes|Minutos|Minutes|Минуты
Usuário|User|Usuario|Utilisateur|Пользователь
Permissão|Permission|Permiso|Autorisation|Права
Total|Total|Total|Total|Итого
Estoque|Stock|Inventario|Stock|Склад
Qtd|Qty|Cant.|Qté|Кол-во
Total vendido|Total sold|Total vendido|Total vendu|Всего продано
Atualizar|Refresh|Actualizar|Actualiser|Обновить
Encerrar|End|Finalizar|Terminer|Завершить
Salvar|Save|Guardar|Enregistrer|Сохранить
Buscar|Search|Buscar|Rechercher|Найти
Filtrar|Filter|Filtrar|Filtrer|Фильтр
Filtrar histórico|Filter history|Filtrar historial|Filtrer l'historique|Фильтр истории
Exportar para Excel|Export to Excel|Exportar a Excel|Exporter vers Excel|Экспорт в Excel
Exportar CSV ↓|Export CSV ↓|Exportar CSV ↓|Exporter CSV ↓|Экспорт CSV ↓
Exportar relatório CSV|Export CSV report|Exportar informe CSV|Exporter le rapport CSV|Экспорт отчёта CSV
Criar|Create|Crear|Créer|Создать
Iniciar|Start|Iniciar|Démarrer|Начать
Iniciar ›|Start ›|Iniciar ›|Démarrer ›|Начать ›
Sim|Yes|Sí|Oui|Да
Não|No|No|Non|Нет
Hoje|Today|Hoy|Aujourd'hui|Сегодня
Este mês|This month|Este mes|Ce mois-ci|Этот месяц
De|From|Desde|Du|С
Até|To|Hasta|Au|По
Carregando…|Loading…|Cargando…|Chargement…|Загрузка…
Histórico completo de sessões|Full session history|Historial completo de sesiones|Historique complet des sessions|Полная история сеансов
Registro de atividades|Activity log|Registro de actividades|Journal d'activité|Журнал действий
Todos os tipos|All types|Todos los tipos|Tous les types|Все типы
Abrir caixa|Open cash register|Abrir caja|Ouvrir la caisse|Открыть кассу
Fechar caixa|Close cash register|Cerrar caja|Fermer la caisse|Закрыть кассу
Caixa atual|Current register|Caja actual|Caisse actuelle|Текущая касса
Vendas|Sales|Ventas|Ventes|Продажи
Caixas fechados|Closed registers|Cajas cerradas|Caisses fermées|Закрытые кассы
Gerenciamento de Produtos|Product management|Gestión de productos|Gestion des produits|Управление товарами
Gerenciamento de Serviços|Service management|Gestión de servicios|Gestion des services|Управление услугами
Gerenciamento de Categoria|Category management|Gestión de categorías|Gestion des catégories|Управление категориями
+ Nova Categoria|+ New category|+ Nueva categoría|+ Nouvelle catégorie|+ Новая категория
+ Novo Produto|+ New product|+ Nuevo producto|+ Nouveau produit|+ Новый товар
+ Novo Serviço|+ New service|+ Nuevo servicio|+ Nouveau service|+ Новая услуга
Nome da categoria|Category name|Nombre de la categoría|Nom de la catégorie|Название категории
Produtos|Products|Productos|Produits|Товары
Produto|Product|Producto|Produit|Товар
Preço|Price|Precio|Prix|Цена
P. Custo|Cost|Costo|Coût|Себестоимость
Margem|Margin|Margen|Marge|Наценка
P. Venda|Sale price|Precio de venta|Prix de vente|Цена продажи
Cód. Barras|Barcode|Código de barras|Code-barres|Штрихкод
Carrinho|Cart|Carrito|Panier|Корзина
Subtotal|Subtotal|Subtotal|Sous-total|Промежуточный итог
Carrinho vazio.|Cart is empty.|Carrito vacío.|Panier vide.|Корзина пуста.
Finalizar Venda|Finish sale|Finalizar venta|Finaliser la vente|Завершить продажу
Estoque atual|Current stock|Inventario actual|Stock actuel|Текущий остаток
+ Entrada|+ Stock in|+ Entrada|+ Entrée|+ Поступление
Dinheiro esperado|Expected cash|Efectivo esperado|Espèces attendues|Ожидаемые наличные
Diferença|Difference|Diferencia|Différence|Разница
Detalhes|Details|Detalles|Détails|Подробнее
Corujão|All-nighter|Maratón nocturno|Nuit blanche|Ночной марафон
Viradão|Marathon|Maratón|Marathon|Марафон
+ Criar Corujão/Viradão|+ Create all-nighter|+ Crear maratón|+ Créer une nuit blanche|+ Создать марафон
+ Adicionar participantes|+ Add participants|+ Añadir participantes|+ Ajouter des participants|+ Добавить участников
Confirmar pagamento|Confirm payment|Confirmar pago|Confirmer le paiement|Подтвердить оплату
Encerrados|Finished|Finalizados|Terminés|Завершённые
Top 10 Medalhas|Top 10 Medals|Top 10 Medallas|Top 10 Médailles|Топ-10 по медалям
Top 10 Participação em Viradão|Top 10 Marathon participation|Top 10 Participación en maratón|Top 10 Participation aux marathons|Топ-10 участников марафонов
Top 10 Recargas Mês|Top 10 Monthly top-ups|Top 10 Recargas del mes|Top 10 Recharges du mois|Топ-10 пополнений за месяц
Mês das recargas|Top-up month|Mes de recargas|Mois des recharges|Месяц пополнений
Programa fidelidade automático|Automatic loyalty program|Programa de fidelidad automático|Programme de fidélité automatique|Автоматическая программа лояльности
Mensagem do prêmio|Reward message|Mensaje del premio|Message de récompense|Сообщение о награде
Medalhas Corujão/Viradão|All-nighter medals|Medallas de maratón|Médailles nuit blanche|Медали за марафон
Promoções|Promotions|Promociones|Promotions|Акции
Configurar programa|Configure program|Configurar programa|Configurer le programme|Настроить программу
Financeiro e resultados|Finance and results|Finanzas y resultados|Finances et résultats|Финансы и результаты
Diário|Daily|Diario|Quotidien|Ежедневно
Mensal|Monthly|Mensual|Mensuel|Ежемесячно
Anual|Yearly|Anual|Annuel|Ежегодно
Ver fatura|View invoice|Ver factura|Voir la facture|Открыть счёт
Faturas e transações|Invoices and transactions|Facturas y transacciones|Factures et transactions|Счета и операции
Despesas|Expenses|Gastos|Dépenses|Расходы
Contas de acesso|Access accounts|Cuentas de acceso|Comptes d'accès|Учётные записи
Conta ativa|Active account|Cuenta activa|Compte actif|Активная учётная запись
Backup completo do servidor|Full server backup|Copia completa del servidor|Sauvegarde complète du serveur|Полная резервная копия сервера
Horário|Time|Horario|Heure|Время
Pasta de destino|Destination folder|Carpeta de destino|Dossier de destination|Папка назначения
Salvar backup diário|Save daily backup|Guardar copia diaria|Enregistrer la sauvegarde quotidienne|Сохранить ежедневную копию
Servidor IP|Server IP|IP del servidor|IP du serveur|IP сервера
Atualizar Automático ›|Auto update ›|Actualización automática ›|Mise à jour automatique ›|Автообновление ›
Bloquear Gerenciador de Tarefas|Block Task Manager|Bloquear Administrador de tareas|Bloquer le Gestionnaire des tâches|Блокировать диспетчер задач
Bloquear Configurações|Block Settings|Bloquear Configuración|Bloquer les Paramètres|Блокировать параметры
Salvar para todos os PCs|Save for all PCs|Guardar para todos los PC|Enregistrer pour tous les PC|Сохранить для всех ПК
Recebimento pelos clientes|Received by clients|Recepción por los clientes|Réception par les clients|Получение клиентами
Enviar mensagem|Send message|Enviar mensaje|Envoyer un message|Отправить сообщение
Enviar Mensagem|Send Message|Enviar Mensaje|Envoyer un message|Отправить сообщение
Enviar|Send|Enviar|Envoyer|Отправить
Liberar em modo administrador|Release in admin mode|Liberar en modo administrador|Libérer en mode administrateur|Открыть в режиме администратора
Liberar todas|Release all|Liberar todas|Tout libérer|Открыть все
Liberar disponíveis|Release available|Liberar disponibles|Libérer les disponibles|Открыть свободные
Liberar específica|Release selected|Liberar específica|Libérer la sélection|Открыть выбранную
Encerrar sessões|End sessions|Finalizar sesiones|Terminer les sessions|Завершить сеансы
Encerrar todas em uso|End all in use|Finalizar todas en uso|Terminer toutes les sessions|Завершить все занятые
Encerrar específica|End selected|Finalizar específica|Terminer la sélection|Завершить выбранную
Desligar computadores|Shut down computers|Apagar computadoras|Éteindre les ordinateurs|Выключить компьютеры
Desligar todas|Shut down all|Apagar todas|Tout éteindre|Выключить все
Desligar disponíveis|Shut down available|Apagar disponibles|Éteindre les disponibles|Выключить свободные
Desligar específica|Shut down selected|Apagar específica|Éteindre la sélection|Выключить выбранную
Reiniciar computadores|Restart computers|Reiniciar computadoras|Redémarrer les ordinateurs|Перезагрузить компьютеры
Reiniciar todas|Restart all|Reiniciar todas|Tout redémarrer|Перезагрузить все
Reiniciar disponíveis|Restart available|Reiniciar disponibles|Redémarrer les disponibles|Перезагрузить свободные
Reiniciar específica|Restart selected|Reiniciar específica|Redémarrer la sélection|Перезагрузить выбранную
Computador específico|Specific computer|Computadora específica|Ordinateur spécifique|Конкретный компьютер
Alterar senha|Change password|Cambiar contraseña|Changer le mot de passe|Сменить пароль
Alterar minha senha|Change my password|Cambiar mi contraseña|Changer mon mot de passe|Сменить мой пароль
Senha atual|Current password|Contraseña actual|Mot de passe actuel|Текущий пароль
Nova senha|New password|Nueva contraseña|Nouveau mot de passe|Новый пароль
Idioma|Language|Idioma|Langue|Язык
Ajuda|Help|Ayuda|Aide|Помощь
Feedback|Feedback|Comentarios|Commentaires|Отзыв
Enviar feedback|Send feedback|Enviar comentarios|Envoyer un commentaire|Отправить отзыв
Comentário|Comment|Comentario|Commentaire|Комментарий
Transferir/Remover saldo|Transfer/Remove balance|Transferir/Quitar saldo|Transférer/Retirer le solde|Перевод/списание баланса
Histórico de movimentações|Transaction history|Historial de movimientos|Historique des mouvements|История операций
Sangria|Withdrawal|Retiro|Retrait|Изъятие
Suprimento|Deposit|Ingreso|Apport|Внесение
▤ Estoque|▤ Stock|▤ Inventario|▤ Stock|▤ Склад
▣ Caixa atual|▣ Current register|▣ Caja actual|▣ Caisse actuelle|▣ Текущая касса
◷ Caixas fechados|◷ Closed registers|◷ Cajas cerradas|◷ Caisses fermées|◷ Закрытые кассы
● Conectado ao servidor|● Connected to server|● Conectado al servidor|● Connecté au serveur|● Подключено к серверу
• Caixa fechado|• Register closed|• Caja cerrada|• Caisse fermée|• Касса закрыта
Caixa fechado|Register closed|Caja cerrada|Caisse fermée|Касса закрыта
CAIXA FECHADO|REGISTER CLOSED|CAJA CERRADA|CAISSE FERMÉE|КАССА ЗАКРЫТА
Buscar produto ou categoria|Search product or category|Buscar producto o categoría|Rechercher un produit ou une catégorie|Поиск товара или категории
Buscar Usuário/Nick|Search username|Buscar usuario/nick|Rechercher un pseudo|Поиск по имени пользователя
Buscar por nome ou código de barras…|Search by name or barcode…|Buscar por nombre o código de barras…|Rechercher par nom ou code-barres…|Поиск по названию или штрихкоду…
Opcional|Optional|Opcional|Facultatif|Необязательно
Nenhuma sessão encontrada.|No sessions found.|No se encontraron sesiones.|Aucune session trouvée.|Сеансы не найдены.
Registrar|Register|Registrar|Enregistrer|Записать
Liberar|Release|Liberar|Libérer|Открыть
`;
  const dict = new Map();
  for (const line of RAW.split('\n')) { const p = line.split('|'); if (p.length === 5 && p[0].trim()) dict.set(p[0].trim(), p.map(x => x.trim())); }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'CODE', 'OPTION_SKIP']);
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const texts = new WeakMap(), attrs = new WeakMap();
  let lang = 'pt-BR', busy = false;
  try { const saved = localStorage.getItem('gz-lang'); if (saved && LANGS[saved]) lang = saved; } catch {}
  const translate = pt => { if (lang === 'pt-BR') return pt; const key = pt.trim(); if (!key) return pt; const row = dict.get(key); return row && row[COL[lang]] ? pt.replace(key, row[COL[lang]]) : pt; };
  function textNode(n) {
    const p = n.parentNode; if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-no-i18n]'))) return;
    let rec = texts.get(n); if (!rec || n.nodeValue !== rec.shown) { rec = {pt: n.nodeValue}; texts.set(n, rec); }
    const out = translate(rec.pt); rec.shown = out; if (n.nodeValue !== out) n.nodeValue = out;
  }
  function element(el) {
    if (el.closest && el.closest('[data-no-i18n]')) return;
    let rec = attrs.get(el); if (!rec) { rec = {}; attrs.set(el, rec); }
    for (const a of ATTRS) { if (!el.hasAttribute(a)) continue; const v = el.getAttribute(a); let r = rec[a]; if (!r || v !== r.shown) { r = {pt: v}; rec[a] = r; } const out = translate(r.pt); r.shown = out; if (v !== out) el.setAttribute(a, out); }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP.has(root.nodeName)) return; element(root); }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) textNode(n); else if (!SKIP.has(n.nodeName)) element(n); }
  }
  function apply() { if (busy) return; busy = true; try { walk(document.body); } finally { busy = false; } document.documentElement.lang = lang; }
  const observer = new MutationObserver(list => {
    if (busy) return; busy = true;
    try { for (const m of list) { if (m.type === 'characterData') textNode(m.target); else if (m.type === 'attributes') element(m.target); else m.addedNodes.forEach(walk); } } finally { busy = false; }
  });
  function start() { apply(); observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS}); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.gzI18n = {
    langs: LANGS, get lang() { return lang; },
    set(next) { if (!LANGS[next] || next === lang) return; lang = next; try { localStorage.setItem('gz-lang', lang); } catch {} apply(); },
    t: translate
  };
})();

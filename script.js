/* script.js
   Tässä tiedostossa on koko sovelluksen logiikka:
   - tehtävien lisääminen, poisto, merkitseminen
   - localStorage tallennus / lataus
   - hakutoiminnot, suodattimet
   - drag & drop järjestely
   - deadline-ilmoitukset (sivulla näkyvä)
   - deadline mennyt -> punainen tausta
   - teemavaihto
*/


// Elementtien valinta
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const categorySelect = document.getElementById('categorySelect');
const deadlineInput = document.getElementById('deadlineInput');
const errorMsg = document.getElementById('errorMsg');
const searchInput = document.getElementById('searchInput');
const allBtn = document.getElementById('allBtn');
const activeBtn = document.getElementById('activeBtn');
const doneBtn = document.getElementById('doneBtn');
const categoryFilter = document.getElementById('categoryFilter');
const taskList = document.getElementById('taskList');
const counter = document.getElementById('counter');
const clearBtn = document.getElementById('clearBtn');
const themeSwitch = document.getElementById('themeSwitch');


// Sovelluksen tila
// Ladataan localStoragesta aiemmat tehtävät (avain 'tasks')
// Jos ei löydy, käytetään tyhjää taulukkoa
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

// Nykyinen suodatin (kaikki / aktiiviset / tehdyt)
let currentFilter = 'all';



// Tallenna tasks localStorageen
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Haetaan tehtävä id:llä
function findTaskIndexById(id) {
  return tasks.findIndex(t => t.id === id);
}

// Muotoile datetime-local -> luettava muoto
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // Palauta paikallinen muoto
  return d.toLocaleString('fi-FI', { hour12: false });
}

// Tarkistaa onko deadline umpeutunut
function isOverdue(deadline) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

// Tarkistaa onko deadline lähestymässä (alle 24 tuntia)
function isImminent(deadline) {
  if (!deadline) return false;
  const now = Date.now();
  const diff = new Date(deadline).getTime() - now;
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}


// Renderöinti: piirtää tehtävälistan DOMiin

function renderTasks() {
  // Tyhjennetään lista
  taskList.innerHTML = '';

  // Sovelletaan suodatinta
  let visible = tasks.filter(task => {
    if (currentFilter === 'active') return !task.done;
    if (currentFilter === 'done') return task.done;
    return true; 
  });

  // Kategoriansuodatus
  const catFilter = categoryFilter.value;
  if (catFilter !== 'all') {
    visible = visible.filter(t => t.category === catFilter);
  }

  // Hakusana
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    visible = visible.filter(t => t.text.toLowerCase().includes(q));
  }

  // Käydään läpi näkyvät tehtävät ja luodaan elementit
  visible.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.priority}`;
    if (task.done) li.classList.add('done');
    // jos umpeutunut deadline
    if (isOverdue(task.deadline) && !task.done) li.classList.add('overdue');

    // data-id drag & drop toimintoihin
    li.dataset.id = task.id;
    li.draggable = true;

    // sisällöt: aika, kategoria, deadline
    const main = document.createElement('div');
    main.className = 'task-main';
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.text;
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    // kategoria-nappi / badge
    const cat = document.createElement('span');
    cat.textContent = task.category.charAt(0).toUpperCase() + task.category.slice(1);
    cat.style.padding = '4px 8px';
    cat.style.borderRadius = '8px';
    cat.style.fontSize = '0.85rem';
    cat.style.background = 'rgba(37,99,235,0.08)';
    cat.style.color = 'var(--muted)';

    // luontiaika & deadline-teksti
    const created = document.createElement('span');
    created.textContent = `Luotu: ${task.created}`;
    created.style.marginLeft = '6px';

    meta.appendChild(cat);
    meta.appendChild(created);

    if (task.deadline) {
      const dl = document.createElement('span');
      dl.textContent = ` | Määräaika: ${formatDateTime(task.deadline)}`;
      dl.style.marginLeft = '6px';
      meta.appendChild(dl);

      // deadlinen lähestyessä (alle 24h) ja ei ole valmis -> näytetään varoitus
      if (isImminent(task.deadline) && !task.done && !isOverdue(task.deadline)) {
        const warn = document.createElement('span');
        warn.textContent = ' Deadline lähestyy!';
        warn.className = 'warn';
        warn.style.marginLeft = '8px';
        meta.appendChild(warn);
      }
    }

    main.appendChild(title);
    main.appendChild(meta);

    // Toimintopainikkeet:  valmis / poista / kumoa
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const doneBtn = document.createElement('button');
    doneBtn.innerHTML = task.done ? ' Kumoa' : ' Valmis';
    doneBtn.className = task.done ? '' : 'primary';
    doneBtn.addEventListener('click', () => toggleDone(task.id));

    const delBtn = document.createElement('button');
    delBtn.innerHTML = 'Poista';
    delBtn.addEventListener('click', () => deleteTask(task.id));

    actions.appendChild(doneBtn);
    actions.appendChild(delBtn);

    li.appendChild(main);
    li.appendChild(actions);

    // Drag & drop tapahtumat
    li.addEventListener('dragstart', dragStart);
    li.addEventListener('dragover', dragOver);
    li.addEventListener('drop', dropItem);
    li.addEventListener('dragend', dragEnd);

    taskList.appendChild(li);
  });

  updateCounter();
}


// Laskurin päivitys
function updateCounter() {
  const total = tasks.length;
  const open = tasks.filter(t => !t.done).length;
  counter.textContent = `Aktiivisia: ${open} / ${total}`;
}


// Tehtävän lisäys
addBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  const priority = categorySelect ? categorySelect.value : 'normal'; // jos ID muuttuu
  const deadline = deadlineInput.value || '';

  // Validointi (vähintään 3 merkkiä)
  if (!text || text.length < 3) {
    errorMsg.textContent = 'Kirjoita vähintään 3 merkkiä pitkä tehtävä.';
    return;
  }
  errorMsg.textContent = '';

  // Luodaan tehtävä-olio
  const newTask = {
    id: Date.now(), // yksinkertainen uniikki tunniste
    text,
    category: categorySelect.value,
    priority: priority === 'high' ? 'high' : (priority === 'low' ? 'low' : 'normal'),
    deadline,
    done: false,
    created: new Date().toLocaleString('fi-FI', { hour12:false })
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();

  // Tyhjennetään kentät ja focus takaisin inputtiin
  taskInput.value = '';
  deadlineInput.value = '';
  taskInput.focus();
});

// Myös mahdollista lisätä Enter-näppäimellä
taskInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addBtn.click();
});


// Tehtävän merkitseminen tehdyksi
function toggleDone(id) {
  const idx = findTaskIndex(id);
  if (idx === -1) return;
  tasks[idx].done = !tasks[idx].done;
  saveTasks();
  renderTasks();
}

// Haetaan tehtävän indeksi
function findTaskIndex(id) {
  return tasks.findIndex(t => t.id === id);
}


// Tehtävän poisto
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}


// Drag & drop logiikka
let dragSrcId = null;

function dragStart(e) {
  dragSrcId = this.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  this.classList.add('dragging');
}

function dragOver(e) {
  e.preventDefault(); // sallitaan drop
  e.dataTransfer.dropEffect = 'move';
}

function dropItem(e) {
  e.preventDefault();
  const targetId = this.dataset.id;
  if (!dragSrcId || !targetId || dragSrcId === targetId) return;

  // Siirretään elementin paikka tehtävä-taulukossa
  const srcIndex = tasks.findIndex(t => String(t.id) === String(dragSrcId));
  const tgtIndex = tasks.findIndex(t => String(t.id) === String(targetId));
  const [moved] = tasks.splice(srcIndex, 1);
  tasks.splice(tgtIndex, 0, moved);

  saveTasks();
  renderTasks();
}

function dragEnd() {
  this.classList.remove('dragging');
  dragSrcId = null;
}


// Suodattimet, haku ja kategoriat
allBtn.addEventListener('click', () => { setFilter('all'); });
activeBtn.addEventListener('click', () => { setFilter('active'); });
doneBtn.addEventListener('click', () => { setFilter('done'); });

categoryFilter.addEventListener('change', () => renderTasks());
searchInput.addEventListener('input', () => renderTasks());

function setFilter(f) {
  currentFilter = f;
  // päivitetään napin aktiivisuus tyylillä
  document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
  if (f === 'all') allBtn.classList.add('active');
  if (f === 'active') activeBtn.classList.add('active');
  if (f === 'done') doneBtn.classList.add('active');
  renderTasks();
}


// Teemavaihto
function loadTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  if (theme === 'dark') {
    document.body.classList.add('dark');
    themeSwitch.checked = true;
  } else {
    document.body.classList.remove('dark');
    themeSwitch.checked = false;
  }
}
themeSwitch.addEventListener('change', () => {
  const dark = themeSwitch.checked;
  document.body.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
});
loadTheme(); // ladataan asetukset sivun alussa


// Tyhjennä kaikki
clearBtn.addEventListener('click', () => {
  if (confirm('Poistetaanko kaikki tehtävät?')) {
    tasks = [];
    saveTasks();
    renderTasks();
  }
});


// Aikaleiman / deadline-tarkistus ajastetusti
// Rerenderöinti 60 sekunnin välein.
setInterval(() => {
  renderTasks();
}, 60 * 1000);


// Ladataan sivu viimeksi tallennetut tehtävät
renderTasks();

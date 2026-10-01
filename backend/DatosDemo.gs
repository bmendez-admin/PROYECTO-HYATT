const VENUES_DEMO = [
  { venue_id: 'bites', nombre: 'Bites', zona_horaria: 'America/Cancun', hora_apertura: '11:00', hora_cierre: '16:00', dia_operativo_inicio: '04:00', turnos_activos_max: 2, turno_vencido_horas: 12, semaforo_amarillo_min: 5, semaforo_rojo_min: 10, meta_espera_min: 10, activo: true },
  { venue_id: 'barefoot', nombre: 'Barefoot Grill', zona_horaria: 'America/Cancun', hora_apertura: '12:00', hora_cierre: '17:00', dia_operativo_inicio: '04:00', turnos_activos_max: 2, turno_vencido_horas: 12, semaforo_amarillo_min: 5, semaforo_rojo_min: 10, meta_espera_min: 10, activo: true },
  { venue_id: 'nook', nombre: 'The Nook Café', zona_horaria: 'America/Cancun', hora_apertura: '00:00', hora_cierre: '24:00', dia_operativo_inicio: '04:00', turnos_activos_max: 2, turno_vencido_horas: 12, semaforo_amarillo_min: 5, semaforo_rojo_min: 10, meta_espera_min: 10, activo: true }
];

const MENU_BITES = [
  ['Para compartir', 'To share', 'Guacamole con totopos', 'Guacamole with tortilla chips', 'Aguacate machacado al momento con cilantro y limón.', 'Freshly mashed avocado with cilantro and lime.', 'vegetariano', 40, 10],
  ['Para compartir', 'To share', 'Croquetas de jamón', 'Ham croquettes', 'Croquetas cremosas de jamón serrano.', 'Creamy serrano ham croquettes.', '', 40, 10],
  ['Para compartir', 'To share', 'Papas bravas', 'Patatas bravas', 'Papas crujientes con salsa picante y alioli.', 'Crispy potatoes with spicy sauce and aioli.', 'vegetariano,picante', 40, 10],
  ['Para compartir', 'To share', 'Tabla de quesos', 'Cheese board', 'Selección de quesos, frutos secos y mermelada.', 'Selection of cheeses, nuts and jam.', 'vegetariano', 25, 6],
  ['Del mar', 'From the sea', 'Ceviche de pescado', 'Fish ceviche', 'Pescado del día en limón con cebolla morada y chile.', 'Catch of the day in lime with red onion and chili.', 'sin gluten,picante', 30, 8],
  ['Del mar', 'From the sea', 'Camarones al ajillo', 'Garlic shrimp', 'Camarones salteados con ajo y chile guajillo.', 'Shrimp sautéed with garlic and guajillo chili.', 'picante', 30, 8],
  ['Del mar', 'From the sea', 'Tostada de atún', 'Tuna tostada', 'Atún fresco sobre tostada crujiente con aguacate.', 'Fresh tuna on a crispy tostada with avocado.', '', 30, 8],
  ['Frescos', 'Fresh', 'Ensalada caprese', 'Caprese salad', 'Tomate, mozzarella fresca y albahaca.', 'Tomato, fresh mozzarella and basil.', 'vegetariano,sin gluten', 35, 8],
  ['Frescos', 'Fresh', 'Ensalada de quinoa', 'Quinoa salad', 'Quinoa con vegetales asados y vinagreta cítrica.', 'Quinoa with roasted vegetables and citrus vinaigrette.', 'vegano,sin gluten', 35, 8],
  ['Calientes', 'Hot', 'Brochetas de pollo', 'Chicken skewers', 'Pollo marinado a las brasas con salsa de yogur.', 'Grilled marinated chicken with yogurt sauce.', 'sin gluten', 40, 10],
  ['Calientes', 'Hot', 'Empanadas de queso', 'Cheese empanadas', 'Masa dorada rellena de queso fundido.', 'Golden pastry filled with melted cheese.', 'vegetariano', 40, 10],
  ['Dulces', 'Sweet', 'Churros con chocolate', 'Churros with chocolate', 'Churros recién hechos con chocolate caliente.', 'Freshly made churros with hot chocolate.', 'vegetariano', 40, 10],
  ['Dulces', 'Sweet', 'Panna cotta de frutos rojos', 'Berry panna cotta', 'Crema suave de vainilla con salsa de frutos rojos.', 'Smooth vanilla cream with berry sauce.', 'vegetariano,sin gluten', 30, 8]
];

const APELLIDOS_DEMO = [
  'Alvarado', 'Beltrán', 'Cárdenas', 'Domínguez', 'Espinosa',
  'Fuentes', 'Galindo', 'Herrera', 'Ibarra', 'Jiménez',
  'Krause', 'Lozano', 'Montenegro', 'Navarro', 'Ochoa',
  'Paredes', 'Quintero', 'Reyes', 'Salgado', 'Treviño'
];

const CHEFS_DEMO = [
  { chef_id: 'chef-01', nombre: 'Mateo', activo: true },
  { chef_id: 'chef-02', nombre: 'Lucía', activo: true },
  { chef_id: 'chef-03', nombre: 'Andrés', activo: true }
];

function productosBites() {
  return MENU_BITES.map((fila, i) => ({
    producto_id: 'bites-' + ('00' + (i + 1)).slice(-3),
    venue_id: 'bites',
    categoria_es: fila[0],
    categoria_en: fila[1],
    nombre_es: fila[2],
    nombre_en: fila[3],
    descripcion_es: fila[4],
    descripcion_en: fila[5],
    imagen: '',
    etiquetas: fila[6],
    stock_actual: fila[7],
    stock_minimo: fila[8],
    activo: true,
    orden: i + 1
  }));
}

function movimientosIniciales(productos) {
  const ahora = new Date();
  return productos.map(producto => ({
    mov_id: 'MOV-' + producto.producto_id,
    venue_id: producto.venue_id,
    producto_id: producto.producto_id,
    tipo: 'inicial',
    cantidad: producto.stock_actual,
    stock_resultante: producto.stock_actual,
    hora: ahora,
    responsable: 'setup'
  }));
}

function generarHuespedes() {
  const edificios = [{ letra: 'A', base: 0 }, { letra: 'B', base: 400 }];
  const huespedes = [];
  let indice = 0;
  let siguienteApellido = 0;
  edificios.forEach(edificio => {
    for (let piso = 1; piso <= 4; piso++) {
      for (let habitacion = 1; habitacion <= 5; habitacion++) {
        const cuarto = String(edificio.base + piso * 100 + habitacion);
        const ocupado = indice % 2 === 0;
        huespedes.push({
          huesped_id: 'H' + cuarto,
          cuarto: cuarto,
          edificio: edificio.letra,
          piso: piso,
          nombre_display: ocupado ? APELLIDOS_DEMO[siguienteApellido++] : '',
          ocupado: ocupado
        });
        indice++;
      }
    }
  });
  return huespedes;
}
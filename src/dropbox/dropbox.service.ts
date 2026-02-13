import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { Dropbox } from 'dropbox';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DropboxService {
  private readonly logger = new Logger(DropboxService.name);
  private dropboxClient: Dropbox;
  private rootFolder: string;

  constructor(private configService: ConfigService) {
    this.rootFolder = this.configService.get<string>('DROPBOX_ROOT_FOLDER') || '/ayala-ordenes';

    // Soporte para refresh tokens (recomendado) o access tokens (legacy)
    const refreshToken = this.configService.get<string>('DROPBOX_REFRESH_TOKEN');
    const appKey = this.configService.get<string>('DROPBOX_APP_KEY');
    const appSecret = this.configService.get<string>('DROPBOX_APP_SECRET');
    const accessToken = this.configService.get<string>('DROPBOX_ACCESS_TOKEN');

    if (refreshToken && appKey && appSecret) {
      // Modo recomendado: Usar refresh token (nunca expira)
      this.logger.log('Dropbox configurado con refresh token');
      this.dropboxClient = new Dropbox({
        clientId: appKey,
        clientSecret: appSecret,
        refreshToken: refreshToken,
      });
    } else if (accessToken && accessToken !== 'TU_ACCESS_TOKEN_AQUI') {
      // Modo legacy: Usar access token directo (expira en 4 horas)
      this.logger.warn(
        'Dropbox configurado con access token directo. ' +
        'Este token expira cada 4 horas. ' +
        'Se recomienda migrar a refresh tokens para evitar expiración.'
      );
      this.dropboxClient = new Dropbox({
        accessToken: accessToken,
      });
    } else {
      this.logger.error(
        'Dropbox no está configurado correctamente. ' +
        'Debes configurar DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY y DROPBOX_APP_SECRET ' +
        'o usar DROPBOX_ACCESS_TOKEN (no recomendado) en el archivo .env'
      );
      // Crear cliente con configuración mínima para evitar errores
      this.dropboxClient = new Dropbox({
        accessToken: '',
      });
    }
  }

  /**
   * Obtiene el nombre del mes en español basado en el número de mes
   * @param monthNumber - Número del mes (0-11)
   * @returns Nombre del mes en español
   */
  private getMonthName(monthNumber: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[monthNumber];
  }

  /**
   * Genera la ruta de carpeta basada en el año y mes de la fecha de registro
   * @param fechaRegistro - Fecha de registro de la orden
   * @param tipoOrden - Tipo de orden ('ordenes-compra' o 'ordenes-servicio')
   * @returns Ruta de la carpeta
   */
  getFolderPath(fechaRegistro: Date, tipoOrden: string): string {
    const year = fechaRegistro.getFullYear();
    const month = fechaRegistro.getMonth();
    const monthName = this.getMonthName(month);

    return `/${tipoOrden}/${year}/${monthName}`;
  }

  /**
   * Verifica si existe un archivo con el mismo nombre base y retorna el siguiente sufijo disponible
   * @param folderPath - Ruta de la carpeta
   * @param baseFileName - Nombre base del archivo (sin extensión)
   * @param extension - Extensión del archivo (incluye el punto)
   * @returns Nombre de archivo con sufijo si es necesario
   */
  private async getAvailableFileName(
    folderPath: string,
    baseFileName: string,
    extension: string,
  ): Promise<string> {
    try {
      const fullFolderPath = `${this.rootFolder}${folderPath}`;

      // Intentar listar archivos en la carpeta
      let existingFiles: string[] = [];
      try {
        const response = await this.dropboxClient.filesListFolder({
          path: fullFolderPath,
        });
        existingFiles = response.result.entries.map(entry => entry.name);
      } catch (error: any) {
        // Si la carpeta no existe, no hay archivos existentes
        if (error?.error?.error?.['.tag'] === 'path' &&
            error?.error?.error?.path?.['.tag'] === 'not_found') {
          return `${baseFileName}${extension}`;
        }
        throw error;
      }

      // Verificar si el archivo base existe
      const baseFile = `${baseFileName}${extension}`;
      if (!existingFiles.includes(baseFile)) {
        return baseFile;
      }

      // Buscar archivos con el mismo nombre base y sufijos numéricos
      const pattern = new RegExp(`^${baseFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-\\d+)?\\${extension}$`);
      const matchingFiles = existingFiles.filter(file => pattern.test(file));

      // Extraer los sufijos numéricos existentes
      const suffixes = matchingFiles
        .map(file => {
          const match = file.match(new RegExp(`^${baseFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\${extension}$`));
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => num > 0);

      // Encontrar el siguiente sufijo disponible
      const nextSuffix = suffixes.length > 0 ? Math.max(...suffixes) + 1 : 1;

      return `${baseFileName}-${nextSuffix}${extension}`;
    } catch (error) {
      this.logger.error('Error al verificar archivos existentes', error);
      // Si hay error, usar sufijo 1 por defecto
      return `${baseFileName}-1${extension}`;
    }
  }

  /**
   * Sube un archivo a Dropbox
   * @param file - Buffer del archivo a subir
   * @param fileName - Nombre del archivo
   * @param folderPath - Ruta de la carpeta donde se guardará (relativa al root folder)
   * @returns Información del archivo subido incluyendo la URL
   */
  async uploadFile(
    file: Buffer,
    fileName: string,
    folderPath: string = '',
  ): Promise<{
    success: boolean;
    message: string;
    fileUrl: string;
    filePath: string;
    fileId: string;
  }> {
    try {
      // Sanitizar el nombre del archivo para evitar problemas
      const sanitizedFileName = this.sanitizeFileName(fileName);

      // Construir la ruta completa del archivo
      const fullPath = `${this.rootFolder}${folderPath}/${sanitizedFileName}`;

      this.logger.log(`Subiendo archivo a Dropbox: ${fullPath}`);

      // Subir el archivo a Dropbox
      const response = await this.dropboxClient.filesUpload({
        path: fullPath,
        contents: file,
        mode: { '.tag': 'overwrite' }, // Sobrescribir si existe
        mute: false,
      });

      this.logger.log(`Archivo subido exitosamente: ${response.result.name}`);

      // Crear un enlace compartido para acceder al archivo (SOLO LECTURA)
      let sharedLink: string;
      try {
        const linkResponse = await this.dropboxClient.sharingCreateSharedLinkWithSettings({
          path: fullPath,
          settings: {
            requested_visibility: { '.tag': 'public' },
            // Configurar como SOLO LECTURA - los usuarios pueden ver y descargar, pero NO editar
            access: { '.tag': 'viewer' },
            allow_download: true,
          },
        });
        sharedLink = linkResponse.result.url;
      } catch (linkError: any) {
        // Si el enlace ya existe, obtenerlo
        if (linkError?.error?.error?.['.tag'] === 'shared_link_already_exists') {
          const existingLinks = await this.dropboxClient.sharingListSharedLinks({
            path: fullPath,
          });
          sharedLink = existingLinks.result.links[0]?.url || '';
        } else {
          this.logger.warn('No se pudo crear enlace compartido', linkError);
          sharedLink = fullPath;
        }
      }

      return {
        success: true,
        message: 'Archivo subido exitosamente',
        fileUrl: sharedLink,
        filePath: fullPath,
        fileId: response.result.id,
      };
    } catch (error) {
      this.logger.error('Error al subir archivo a Dropbox', error);
      throw new InternalServerErrorException(
        'Error al subir el archivo a Dropbox: ' +
        (error instanceof Error ? error.message : 'Error desconocido')
      );
    }
  }

  /**
   * Sube un archivo de orden (compra o servicio) a Dropbox con nomenclatura específica
   * @param file - Buffer del archivo a subir
   * @param numeroOrden - Número de la orden
   * @param fechaRegistro - Fecha de registro de la orden
   * @param tipoOrden - Tipo de orden ('ordenes-compra' o 'ordenes-servicio')
   * @param originalFileName - Nombre original del archivo para obtener la extensión
   * @returns Información del archivo subido incluyendo la URL
   */
  async uploadOrdenFile(
    file: Buffer,
    numeroOrden: string,
    fechaRegistro: Date,
    tipoOrden: 'ordenes-compra' | 'ordenes-servicio',
    originalFileName: string,
  ): Promise<{
    success: boolean;
    message: string;
    fileUrl: string;
    filePath: string;
    fileId: string;
    fileName: string;
  }> {
    let uploadedFilePath: string | null = null;

    try {
      this.logger.log(
        `Iniciando subida de archivo para orden ${numeroOrden} (${tipoOrden})`,
      );

      // Validar que el buffer no esté vacío
      if (!file || file.length === 0) {
        throw new InternalServerErrorException('El archivo está vacío');
      }

      // Obtener la extensión del archivo original
      const extension = originalFileName.substring(originalFileName.lastIndexOf('.'));

      // Generar la ruta de la carpeta basada en año/mes
      const folderPath = this.getFolderPath(fechaRegistro, tipoOrden);
      this.logger.log(`Ruta de carpeta generada: ${folderPath}`);

      // Obtener el nombre de archivo disponible (con sufijo si es necesario)
      const fileName = await this.getAvailableFileName(folderPath, numeroOrden, extension);
      this.logger.log(`Nombre de archivo determinado: ${fileName}`);

      // Subir el archivo
      const result = await this.uploadFile(file, fileName, folderPath);
      uploadedFilePath = result.filePath;

      // Validar que el archivo realmente se subió verificando su existencia
      this.logger.log(`Verificando que el archivo se subió correctamente: ${uploadedFilePath}`);

      try {
        await this.getFileMetadata(uploadedFilePath);
        this.logger.log(`✅ Archivo verificado exitosamente en Dropbox: ${uploadedFilePath}`);
      } catch (verifyError) {
        this.logger.error('❌ Error: El archivo no se encontró después de subirlo', verifyError);
        throw new InternalServerErrorException(
          'El archivo se subió pero no se pudo verificar su existencia en Dropbox'
        );
      }

      // Validar que la URL compartida existe
      if (!result.fileUrl || result.fileUrl === uploadedFilePath) {
        this.logger.warn('⚠️ No se pudo generar enlace compartido, usando ruta del archivo');
      } else {
        this.logger.log(`✅ Enlace compartido generado: ${result.fileUrl}`);
      }

      return {
        ...result,
        fileName: fileName,
      };
    } catch (error) {
      this.logger.error('❌ Error al subir archivo de orden a Dropbox', error);

      // Si el archivo se subió pero hubo un error posterior, intentar limpieza (opcional)
      if (uploadedFilePath) {
        this.logger.warn(`⚠️ Intentando eliminar archivo parcialmente subido: ${uploadedFilePath}`);
        try {
          await this.deleteFile(uploadedFilePath);
          this.logger.log(`🗑️ Archivo eliminado por rollback: ${uploadedFilePath}`);
        } catch (deleteError) {
          this.logger.error('❌ No se pudo eliminar el archivo durante rollback', deleteError);
        }
      }

      throw new InternalServerErrorException(
        'Error al subir el archivo de orden a Dropbox: ' +
        (error instanceof Error ? error.message : 'Error desconocido')
      );
    }
  }

  /**
   * Elimina un archivo de Dropbox dado su enlace compartido
   * @param sharedUrl - URL compartida del archivo
   */
  async deleteFileBySharedUrl(sharedUrl: string): Promise<boolean> {
    try {
      const meta = await this.dropboxClient.sharingGetSharedLinkMetadata({ url: sharedUrl });
      const path = (meta.result as any).path_lower as string | undefined;
      if (!path) return false;
      return this.deleteFile(path);
    } catch (error) {
      this.logger.warn('No se pudo eliminar el archivo anterior de Dropbox', error);
      return false;
    }
  }

  /**
   * Elimina un archivo de Dropbox
   * @param filePath - Ruta completa del archivo a eliminar
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await this.dropboxClient.filesDeleteV2({
        path: filePath,
      });
      this.logger.log(`Archivo eliminado de Dropbox: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error('Error al eliminar archivo de Dropbox', error);
      return false;
    }
  }

  /**
   * Obtiene información de un archivo en Dropbox
   * @param filePath - Ruta del archivo
   */
  async getFileMetadata(filePath: string) {
    try {
      const response = await this.dropboxClient.filesGetMetadata({
        path: filePath,
      });
      return response.result;
    } catch (error) {
      this.logger.error('Error al obtener metadata del archivo', error);
      throw new InternalServerErrorException('Error al obtener información del archivo');
    }
  }

  /**
   * Sanitiza el nombre del archivo para evitar caracteres problemáticos
   * @param fileName - Nombre original del archivo
   * @returns Nombre sanitizado
   */
  private sanitizeFileName(fileName: string): string {
    // Reemplazar caracteres no permitidos y espacios
    return fileName
      .replace(/[<>:"/\\|?*]/g, '-') // Caracteres no permitidos en rutas
      .replace(/\s+/g, '_') // Espacios por guiones bajos
      .trim();
  }

  /**
   * Genera un nombre único para el archivo usando timestamp
   * @param originalName - Nombre original del archivo
   * @returns Nombre único con timestamp
   */
  generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
    return `${this.sanitizeFileName(nameWithoutExt)}_${timestamp}${extension}`;
  }
}

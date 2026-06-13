BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[governorates] (
    [id] NVARCHAR(1000) NOT NULL,
    [nameAr] NVARCHAR(1000) NOT NULL,
    [nameEn] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [governorates_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [governorates_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [governorates_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [createdBy] INT,
    [updatedBy] INT,
    CONSTRAINT [governorates_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[cities] (
    [id] NVARCHAR(1000) NOT NULL,
    [nameAr] NVARCHAR(1000) NOT NULL,
    [nameEn] NVARCHAR(1000),
    [governorateId] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [cities_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [cities_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [cities_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [createdBy] INT,
    [updatedBy] INT,
    CONSTRAINT [cities_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [governorates_nameAr_idx] ON [dbo].[governorates]([nameAr]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cities_governorateId_idx] ON [dbo].[cities]([governorateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cities_nameAr_idx] ON [dbo].[cities]([nameAr]);

-- AddForeignKey
ALTER TABLE [dbo].[governorates] ADD CONSTRAINT [governorates_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[governorates] ADD CONSTRAINT [governorates_updatedBy_fkey] FOREIGN KEY ([updatedBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cities] ADD CONSTRAINT [cities_governorateId_fkey] FOREIGN KEY ([governorateId]) REFERENCES [dbo].[governorates]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[cities] ADD CONSTRAINT [cities_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[cities] ADD CONSTRAINT [cities_updatedBy_fkey] FOREIGN KEY ([updatedBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
